const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onDocumentWritten, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

async function getUserFcmToken(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? (doc.data().fcmToken || null) : null;
}

async function sendPushNotification(token, title, body, data = {}) {
    if (!token) return null;
    const message = {
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } }
    };
    try {
        return await messaging.send(message);
    } catch (e) {
        console.error('[sendPush] failed:', e.message);
        return null;
    }
}

async function saveInAppNotification(uid, title, body, type) {
    await db.collection('users').doc(uid)
        .collection('notifications').add({
            title, body, type,
            timestamp: Date.now(),
            read: false
        });
}
