const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

const scheduleOpts = { region: "asia-northeast3" };

// ① 매일 02:00 KST — 24시간 내 반복 포인트 급증 유저 탐지
exports.detectAnomalousPoints = onSchedule(
    { ...scheduleOpts, schedule: "0 2 * * *", timeZone: "Asia/Seoul" },
    async () => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const snap = await db().collection("security_alerts")
            .where("type", "==", "points_spike")
            .where("detectedAt", ">=", Timestamp.fromDate(since))
            .get();

        if (snap.empty) {
            console.log("[Scheduler] detectAnomalousPoints: 최근 24시간 포인트 급증 없음");
            return;
        }

        // userId별 급증 횟수 및 최대 delta 집계
        const spikeMap = {};
        snap.docs.forEach(d => {
            const { userId, delta } = d.data();
            if (!userId) return;
            if (!spikeMap[userId]) spikeMap[userId] = { count: 0, maxDelta: 0 };
            spikeMap[userId].count++;
            if ((delta || 0) > spikeMap[userId].maxDelta) spikeMap[userId].maxDelta = delta;
        });

        // 24시간 내 3회 이상 급증 유저만 경보
        const repeaters = Object.entries(spikeMap).filter(([, v]) => v.count >= 3);
        if (repeaters.length === 0) {
            console.log("[Scheduler] detectAnomalousPoints: 반복 급증 유저 없음");
            return;
        }

        const batch = db().batch();
        for (const [userId, info] of repeaters) {
            const ref = db().collection("security_alerts").doc();
            batch.set(ref, {
                type: "repeat_points_spike",
                userId,
                spikeCount: info.count,
                maxDelta: info.maxDelta,
                windowHours: 24,
                detectedAt: FieldValue.serverTimestamp(),
                source: "scheduler",
            });
            console.warn(`[Scheduler] repeat_points_spike uid=${userId} count=${info.count} maxDelta=${info.maxDelta}`);
        }
        await batch.commit();
        console.log(`[Scheduler] detectAnomalousPoints: ${repeaters.length}명 반복 급증 경보`);
    }
);

// ② 매시간 — 로그인 오류 급증 탐지 (Brute-force 의심)
exports.detectBruteForce = onSchedule(
    { ...scheduleOpts, schedule: "0 * * * *" },
    async () => {
        const since = new Date(Date.now() - 60 * 60 * 1000);
        const snap = await db().collection("app_error_logs")
            .where("createdAt", ">=", Timestamp.fromDate(since))
            .get();

        if (snap.empty) return;

        // auth/* 오류만 집계
        const authErrors = snap.docs
            .map(d => d.data())
            .filter(d => d.code && String(d.code).startsWith("auth/"));

        if (authErrors.length === 0) return;

        // userId 기준 집계
        const errorCounts = {};
        authErrors.forEach(e => {
            const uid = e.uid || e.userId || "_unknown";
            if (!errorCounts[uid]) errorCounts[uid] = { count: 0, codes: new Set() };
            errorCounts[uid].count++;
            if (e.code) errorCounts[uid].codes.add(e.code);
        });

        // 1시간 내 10회 이상 → brute force 경보
        const suspects = Object.entries(errorCounts).filter(([, v]) => v.count >= 10);
        if (suspects.length === 0) return;

        const batch = db().batch();
        for (const [uid, info] of suspects) {
            const ref = db().collection("security_alerts").doc();
            batch.set(ref, {
                type: "brute_force",
                userId: uid === "_unknown" ? null : uid,
                authErrorCount: info.count,
                errorCodes: [...info.codes],
                windowMinutes: 60,
                detectedAt: FieldValue.serverTimestamp(),
                source: "scheduler",
            });
            console.warn(`[Scheduler] brute_force uid=${uid} count=${info.count}`);
        }
        await batch.commit();
        console.log(`[Scheduler] detectBruteForce: ${suspects.length}명 brute force 경보`);
    }
);

// ③ 매주 월요일 09:00 KST — 휴면 어드민 계정 감사
exports.auditAdminAccounts = onSchedule(
    { ...scheduleOpts, schedule: "0 9 * * 1", timeZone: "Asia/Seoul" },
    async () => {
        const auth = getAuth();
        const dormantThresholdMs = 90 * 24 * 60 * 60 * 1000; // 90일
        const now = Date.now();

        const dormantAdmins = [];
        let pageToken;

        do {
            const result = await auth.listUsers(1000, pageToken);
            for (const user of result.users) {
                const claims = user.customClaims || {};
                if (!claims.admin && !claims.adminOperator && !claims.master) continue;

                const lastSignInMs = user.metadata?.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime).getTime()
                    : 0;

                const isDormant = lastSignInMs === 0 || (now - lastSignInMs) > dormantThresholdMs;
                if (!isDormant) continue;

                dormantAdmins.push({
                    uid: user.uid,
                    email: user.email || null,
                    claimType: claims.master ? "master" : claims.admin ? "admin" : "adminOperator",
                    lastSignInAt: lastSignInMs > 0 ? new Date(lastSignInMs).toISOString() : null,
                    dormantDays: lastSignInMs > 0
                        ? Math.floor((now - lastSignInMs) / (24 * 60 * 60 * 1000))
                        : null,
                });
            }
            pageToken = result.pageToken;
        } while (pageToken);

        if (dormantAdmins.length === 0) {
            console.log("[Scheduler] auditAdminAccounts: 휴면 어드민 계정 없음");
            return;
        }

        // 이미 이번 주에 동일 계정에 대한 경보가 있으면 중복 방지
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const existing = await db().collection("security_alerts")
            .where("type", "==", "dormant_admin")
            .where("detectedAt", ">=", Timestamp.fromDate(weekAgo))
            .get();
        const alreadyAlerted = new Set(existing.docs.map(d => d.data().userId));

        const newAlerts = dormantAdmins.filter(a => !alreadyAlerted.has(a.uid));
        if (newAlerts.length === 0) {
            console.log("[Scheduler] auditAdminAccounts: 신규 휴면 경보 없음 (이미 이번 주 알림됨)");
            return;
        }

        const batch = db().batch();
        for (const admin of newAlerts) {
            const ref = db().collection("security_alerts").doc();
            batch.set(ref, {
                type: "dormant_admin",
                userId: admin.uid,
                targetEmail: admin.email,
                claimType: admin.claimType,
                lastSignInAt: admin.lastSignInAt,
                dormantDays: admin.dormantDays,
                detectedAt: FieldValue.serverTimestamp(),
                source: "scheduler",
            });
            console.warn(`[Scheduler] dormant_admin uid=${admin.uid} email=${admin.email} days=${admin.dormantDays}`);
        }
        await batch.commit();
        console.log(`[Scheduler] auditAdminAccounts: ${newAlerts.length}명 휴면 어드민 경보`);
    }
);
