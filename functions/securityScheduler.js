const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

const scheduleOpts = { region: "asia-northeast3" };
const callableOpts = {
    region: "asia-northeast3",
    cors: true,
    invoker: "public",
    enforceAppCheck: true,
};

const MASTER_EMAILS = process.env.MASTER_EMAILS
    ? process.env.MASTER_EMAILS.split(",").map(e => e.trim()).filter(Boolean)
    : [];

async function assertMaster(request) {
    if (request.auth?.token?.master) return;

    const email = request.auth?.token?.email;
    if (email && MASTER_EMAILS.includes(email)) return;

    throw new HttpsError("permission-denied", "마스터 계정만 사용할 수 있습니다.");
}

// ① 매일 02:00 KST — 포인트 이상 증가 통계적 이상치 탐지
exports.detectAnomalousPoints = onSchedule(
    { ...scheduleOpts, schedule: "0 2 * * *", timeZone: "Asia/Seoul" },
    async () => {
        const since = Date.now() - 24 * 60 * 60 * 1000;

        // 지난 24시간 내 points_spike 경보를 userId별로 집계
        const alertsSnap = await db().collection("security_alerts")
            .where("type", "==", "points_spike")
            .where("detectedAt", ">=", new Date(since))
            .get();

        if (alertsSnap.empty) {
            console.log("[Scheduler] detectAnomalousPoints: 24h 내 포인트 급증 없음");
            return;
        }

        // userId별 누적 delta 합산
        const accumByUser = {};
        for (const doc of alertsSnap.docs) {
            const d = doc.data();
            const uid = d.userId;
            if (!uid) continue;
            accumByUser[uid] = (accumByUser[uid] || 0) + (d.delta || 0);
        }

        const entries = Object.entries(accumByUser); // [[uid, totalDelta], ...]
        if (entries.length === 0) return;

        // 평균·표준편차 계산
        const deltas = entries.map(([, v]) => v);
        const mean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
        const variance = deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length;
        const stdDev = Math.sqrt(variance);

        // 3σ 초과 또는 상위 0.1% (최소 1명) 플래그
        const threshold = mean + 3 * stdDev;
        const sorted = entries.sort(([, a], [, b]) => b - a);
        const topCount = Math.max(1, Math.ceil(sorted.length * 0.001));
        const flagged = new Set(sorted.slice(0, topCount).map(([uid]) => uid));

        const batch = db().batch();
        let count = 0;

        for (const [uid, totalDelta] of entries) {
            if (flagged.has(uid) || totalDelta > threshold) {
                const ref = db().collection("security_alerts").doc();
                batch.set(ref, {
                    type: "anomalous_points",
                    userId: uid,
                    pointsGained24h: totalDelta,
                    mean: Math.round(mean),
                    stdDev: Math.round(stdDev),
                    detectedAt: FieldValue.serverTimestamp(),
                });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.warn(`[Scheduler] detectAnomalousPoints: ${count}명 이상 포인트 증가 탐지`);
        } else {
            console.log("[Scheduler] detectAnomalousPoints: 이상치 없음");
        }
    }
);

// ② 매시간 — Brute Force 로그인 실패 탐지
exports.detectBruteForce = onSchedule(
    { ...scheduleOpts, schedule: "0 * * * *" },
    async () => {
        const windowMs = 30 * 60 * 1000; // 30분
        const since = Date.now() - windowMs;
        const THRESHOLD = 5; // 30분 내 5회 초과 시 플래그

        const logsSnap = await db().collection("app_error_logs")
            .where("category", ">=", "auth/")
            .where("category", "<", "auth0")  // auth/* 패턴 범위 쿼리
            .where("createdAt", ">=", since)
            .get();

        if (logsSnap.empty) {
            console.log("[Scheduler] detectBruteForce: 30분 내 인증 오류 없음");
            return;
        }

        // uid별 실패 카운트 집계
        const countByUid = {};
        for (const doc of logsSnap.docs) {
            const d = doc.data();
            const uid = d.uid;
            if (!uid) continue;
            countByUid[uid] = (countByUid[uid] || 0) + 1;
        }

        const batch = db().batch();
        let flagCount = 0;

        for (const [uid, attemptCount] of Object.entries(countByUid)) {
            if (attemptCount > THRESHOLD) {
                const ref = db().collection("security_alerts").doc();
                batch.set(ref, {
                    type: "brute_force",
                    userId: uid,
                    attemptCount,
                    windowMinutes: 30,
                    detectedAt: FieldValue.serverTimestamp(),
                });
                flagCount++;
                console.warn(`[Scheduler] detectBruteForce: uid=${uid} 30분 내 ${attemptCount}회 인증 실패`);
            }
        }

        if (flagCount > 0) {
            await batch.commit();
        } else {
            console.log("[Scheduler] detectBruteForce: 임계값 초과 없음");
        }
    }
);

// ③ 매주 월요일 09:00 KST — 장기 미접속 어드민 계정 감사
exports.auditAdminAccounts = onSchedule(
    { ...scheduleOpts, schedule: "0 9 * * 1", timeZone: "Asia/Seoul" },
    async () => {
        const INACTIVE_DAYS = 90;
        const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);

        // Firebase Auth에서 전체 유저 목록 순회
        let pageToken;
        const inactiveAdmins = [];

        do {
            const result = await getAuth().listUsers(1000, pageToken);
            pageToken = result.pageToken;

            for (const user of result.users) {
                const claims = user.customClaims || {};
                if (!claims.admin && !claims.adminOperator && !claims.master) continue;

                const lastSignIn = user.metadata.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime)
                    : null;

                if (!lastSignIn || lastSignIn < cutoff) {
                    const daysInactive = lastSignIn
                        ? Math.floor((Date.now() - lastSignIn.getTime()) / (24 * 60 * 60 * 1000))
                        : null;
                    inactiveAdmins.push({
                        uid: user.uid,
                        email: user.email || null,
                        claims: Object.keys(claims).filter(k => claims[k]),
                        lastSignIn: lastSignIn ? lastSignIn.toISOString() : null,
                        daysInactive,
                    });
                }
            }
        } while (pageToken);

        if (inactiveAdmins.length === 0) {
            console.log("[Scheduler] auditAdminAccounts: 장기 미접속 어드민 없음");
            return;
        }

        const batch = db().batch();
        for (const admin of inactiveAdmins) {
            const ref = db().collection("security_alerts").doc();
            batch.set(ref, {
                type: "inactive_admin",
                targetUid: admin.uid,
                targetEmail: admin.email,
                claimTypes: admin.claims,
                lastSignIn: admin.lastSignIn,
                daysInactive: admin.daysInactive,
                detectedAt: FieldValue.serverTimestamp(),
            });
            console.warn(`[Scheduler] auditAdminAccounts: uid=${admin.uid} ${admin.daysInactive ?? "∞"}일 미접속`);
        }

        await batch.commit();
        console.log(`[Scheduler] auditAdminAccounts: ${inactiveAdmins.length}명 비활성 어드민 기록`);
    }
);

// ④ 보안 리포트 API — 마스터 전용 24시간 대시보드
exports.getSecurityReport = onCall(callableOpts, async (request) => {
    await assertMaster(request);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    async function countAlerts(type) {
        const snap = await db().collection("security_alerts")
            .where("type", "==", type)
            .where("detectedAt", ">=", since24h)
            .get();
        return snap.size;
    }

    async function getAlerts(type, limitN = 20) {
        const snap = await db().collection("security_alerts")
            .where("type", "==", type)
            .where("detectedAt", ">=", since24h)
            .orderBy("detectedAt", "desc")
            .limit(limitN)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function countAuthErrors() {
        const snap = await db().collection("app_error_logs")
            .where("category", ">=", "auth/")
            .where("category", "<", "auth0")
            .where("createdAt", ">=", since24h.getTime())
            .get();
        return snap.size;
    }

    async function countScreeningFlags() {
        const snap = await db().collection("screening_results")
            .where("flagged", "==", true)
            .where("createdAt", ">=", since24h)
            .get();
        return snap.size;
    }

    async function getAdminGrants() {
        const snap = await db().collection("security_alerts")
            .where("type", "==", "admin_claim_set")
            .where("detectedAt", ">=", since24h)
            .orderBy("detectedAt", "desc")
            .limit(10)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const [
        loginFailures,
        pointAnomalies,
        bruteForceCount,
        contentFlags,
        newAdminGrants,
        inactiveAdminCount,
    ] = await Promise.all([
        countAuthErrors(),
        getAlerts("anomalous_points"),
        countAlerts("brute_force"),
        countScreeningFlags(),
        getAdminGrants(),
        countAlerts("inactive_admin"),
    ]);

    const report = {
        generatedAt: new Date().toISOString(),
        period: "24h",
        loginFailures,
        bruteForceCount,
        pointAnomalies,
        contentFlags,
        newAdminGrants,
        inactiveAdminCount,
    };

    console.log(`[SecurityReport] master=${request.auth?.token?.email} report generated`);
    return report;
});
