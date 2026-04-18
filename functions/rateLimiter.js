const { getFirestore, FieldValue } = require("firebase-admin/firestore");

let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

/**
 * Firestore 트랜잭션 기반 Rate Limiter
 * @param {string} uid - 사용자 UID
 * @param {string} action - 액션 식별자 (e.g. "sendTestNotification")
 * @param {number} maxCalls - windowSeconds 내 최대 허용 호출 수
 * @param {number} windowSeconds - 슬라이딩 윈도우 크기(초)
 * @returns {Promise<boolean>} true=허용, false=Rate Limit 초과
 */
async function checkRateLimit(uid, action, maxCalls, windowSeconds) {
    const ref = db().collection("rate_limits").doc(`${uid}_${action}`);
    const windowMs = windowSeconds * 1000;

    return db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Date.now();

        if (!snap.exists) {
            tx.set(ref, {
                count: 1,
                windowStart: now,
                expiresAt: new Date(now + windowMs),
            });
            return true;
        }

        const data = snap.data();

        if (now - data.windowStart > windowMs) {
            tx.update(ref, {
                count: 1,
                windowStart: now,
                expiresAt: new Date(now + windowMs),
            });
            return true;
        }

        if (data.count >= maxCalls) {
            return false;
        }

        tx.update(ref, { count: FieldValue.increment(1) });
        return true;
    });
}

module.exports = { checkRateLimit };
