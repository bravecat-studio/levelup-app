(function () {
    'use strict';

    const DONE_KEY = 'levelup_rating_done';
    const ASKED_TS_KEY = 'levelup_rating_asked_ts';
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const PLAY_STORE_URL = 'market://details?id=com.levelup.reboot';
    const OVERLAY_ID = 'ratingModal';

    function _lang() {
        return window.AppState?.currentLang || 'ko';
    }

    function _t(key) {
        return window.i18n?.[_lang()]?.[key] || window.i18n?.['ko']?.[key] || '';
    }

    function shouldShow() {
        if (localStorage.getItem(DONE_KEY) === '1') return false;

        const askedTs = parseInt(localStorage.getItem(ASKED_TS_KEY) || '0', 10);
        if (askedTs && (Date.now() - askedTs) < SEVEN_DAYS_MS) return false;

        const level = window.AppState?.user?.level || 0;
        const streak = window.AppState?.user?.streak?.currentStreak || 0;
        if (level < 5 && streak < 3) return false;

        return true;
    }

    function show() {
        if (!shouldShow()) return;
        localStorage.setItem(ASKED_TS_KEY, String(Date.now()));

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;

        const titleEl = overlay.querySelector('.rating-modal-title');
        const bodyEl  = overlay.querySelector('.rating-modal-body');
        const btnYes  = overlay.querySelector('.rating-btn-yes');
        const btnNo   = overlay.querySelector('.rating-btn-no');
        if (titleEl) titleEl.textContent = _t('rating_title');
        if (bodyEl)  bodyEl.textContent  = _t('rating_body');
        if (btnYes)  btnYes.textContent  = _t('rating_btn_yes');
        if (btnNo)   btnNo.textContent   = _t('rating_btn_no');

        overlay.classList.remove('d-none');
        overlay.classList.add('d-flex');
    }

    function close() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        overlay.classList.add('d-none');
        overlay.classList.remove('d-flex');
    }

    function onPositive() {
        close();
        localStorage.setItem(DONE_KEY, '1');
        window.open(PLAY_STORE_URL, '_system');
    }

    function onNegative() {
        close();
    }

    function initCheck() {
        setTimeout(show, 2000);
    }

    function triggerAfterMilestone() {
        setTimeout(show, 1500);
    }

    window.RatingManager = { shouldShow, show, close, onPositive, onNegative, initCheck, triggerAfterMilestone };
    window.ratingOnPositive = onPositive;
    window.ratingOnNegative = onNegative;
})();
