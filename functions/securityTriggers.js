const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

const triggerOpts = { region: "asia-northeast3" };

// 포인트 급증 감지 — users 문서 업데이트 시 실시간 검사
exports.onUserPointsUpdate = onDocumentUpdated(
    { ...triggerOpts, document: "users/{userId}" },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();
        const delta = (after.points || 0) - (before.points || 0);

        if (delta > 50000) {
            await db.collection("security_alerts").add({
                type: "points_spike",
                userId: event.params.userId,
                delta,
                pointsBefore: before.points || 0,
                pointsAfter: after.points || 0,
                detectedAt: FieldValue.serverTimestamp(),
            });
            console.warn(`[SecurityTrigger] points_spike uid=${event.params.userId} delta=${delta}`);
        }
    }
);

// 대량 삭제 감지 — users 문서에서 stats 필드가 한 번에 대규모 감소 시
exports.onUserStatsReset = onDocumentUpdated(
    { ...triggerOpts, document: "users/{userId}" },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();

        const questBefore = before.stats?.totalQuestsCompleted || 0;
        const questAfter = after.stats?.totalQuestsCompleted || 0;

        // 퀘스트 완료 수가 감소한 경우 — 데이터 조작 의심
        if (questBefore > 0 && questAfter < questBefore) {
            await db.collection("security_alerts").add({
                type: "stats_decrease",
                userId: event.params.userId,
                field: "totalQuestsCompleted",
                before: questBefore,
                after: questAfter,
                detectedAt: FieldValue.serverTimestamp(),
            });
            console.warn(`[SecurityTrigger] stats_decrease uid=${event.params.userId} quests: ${questBefore}→${questAfter}`);
        }
    }
);

// 어드민 클레임 부여 감사 — admin_audit_log 신규 문서 생성 시 security_alerts에 기록
exports.onAdminClaimSet = onDocumentCreated(
    { ...triggerOpts, document: "admin_audit_log/{logId}" },
    async (event) => {
        const data = event.data.data();
        await db.collection("security_alerts").add({
            type: "admin_claim_set",
            targetUid: data.targetUid || null,
            targetEmail: data.targetEmail || null,
            grantedBy: data.grantedBy || null,
            claimType: data.claimType || null,
            detectedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[SecurityTrigger] admin_claim_set logId=${event.params.logId}`);
    }
);
