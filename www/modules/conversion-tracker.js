import { fetchAndActivate, getString } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-remote-config.js";
import { logEvent as fbLogEvent } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let _analytics = null;
let _remoteConfig = null;
let _auth = null;
let _db = null;

function init({ analytics, remoteConfig, auth, db }) {
    _analytics = analytics;
    _remoteConfig = remoteConfig;
    _auth = auth;
    _db = db;
}

// --- 전환율 계측 (Conversion Funnel Tracking) ---
const STORAGE_KEY = 'levelup_funnel';

function _getSession() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function _setSession(data) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function _getVariant(key) {
    try {
        return _remoteConfig ? getString(_remoteConfig, key) : (_remoteConfig?.defaultConfig?.[key] || 'unknown');
    } catch { return 'unknown'; }
}

function track(eventName, params = {}) {
    const session = _getSession();
    if (session[eventName]) return;
    session[eventName] = Date.now();
    _setSession(session);

    const payload = {
        ...params,
        onboarding_variant: _getVariant('onboarding_variant'),
        login_layout: _getVariant('login_layout'),
        timestamp: new Date().toISOString(),
    };

    if (_analytics) {
        try { fbLogEvent(_analytics, eventName, payload); } catch {}
    }

    if (window._funnelLogEnabled && _auth?.currentUser) {
        const logRef = doc(_db, 'funnel_events', `${_auth.currentUser.uid}_${eventName}_${Date.now()}`);
        setDoc(logRef, { uid: _auth.currentUser.uid, event: eventName, ...payload }).catch(() => {});
    }

    if (window.AppLogger) AppLogger.info(`[Funnel] ${eventName} ` + JSON.stringify(payload));
}

export const ConversionTracker = {
    track,
    screenView:      ()       => track('funnel_screen_view'),
    loginStart:      (method) => track('funnel_login_start', { method }),
    loginComplete:   (method) => track('funnel_login_complete', { method }),
    signupStart:     (method) => track('funnel_signup_start', { method }),
    signupComplete:  (method) => track('funnel_signup_complete', { method }),
    emailVerified:   ()       => track('funnel_email_verified'),
    onboardingStart: ()       => track('funnel_onboarding_start'),
    onboardingStep:  (step)   => track(`funnel_onboarding_step_${step}`, { step }),
    onboardingDone:  ()       => track('funnel_onboarding_done'),
    firstSession:    ()       => track('funnel_first_session'),
    d1Return:        ()       => track('funnel_d1_return'),
};

export async function initRemoteConfig() {
    if (!_remoteConfig) return;
    try {
        await fetchAndActivate(_remoteConfig);
        if (window.AppLogger) AppLogger.info('[RemoteConfig] fetch & activate 완료');
    } catch (e) {
        console.warn('[RemoteConfig] fetch 실패 (기본값 사용):', e.message);
    }
}

export function getExperimentVariant(key) {
    if (!_remoteConfig) {
        const defaults = { onboarding_variant: 'compact', login_layout: 'social_first' };
        return defaults[key] || '';
    }
    try { return getString(_remoteConfig, key); } catch { return ''; }
}

export { init };
