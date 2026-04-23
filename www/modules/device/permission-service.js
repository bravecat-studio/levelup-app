const PERMISSION_TYPES = Object.freeze({
    GPS: 'gps',
    HEALTH: 'health',
    PUSH: 'push',
});

export function createPermissionService(deps = {}) {
    const {
        getAppState,
        openAppSettings,
        requestPermission,
        updateCameraToggleUI,
        togglePushNotifications,
    } = deps;

    function getPermissionState(type) {
        const appState = typeof getAppState === 'function' ? getAppState() : null;
        const user = appState && appState.user ? appState.user : {};

        switch (type) {
            case PERMISSION_TYPES.GPS:
                return user.gpsEnabled ? 'granted' : 'denied';
            case PERMISSION_TYPES.HEALTH:
                return user.syncEnabled ? 'granted' : 'denied';
            case PERMISSION_TYPES.PUSH:
                return user.pushEnabled ? 'granted' : 'denied';
            default:
                return 'unknown';
        }
    }

    async function runRequestPermission(type) {
        if (typeof requestPermission !== 'function') return null;
        return requestPermission(type);
    }

    function runOpenAppSettings() {
        if (typeof openAppSettings === 'function') return openAppSettings();
        return undefined;
    }

    function runUpdateCameraToggleUI() {
        if (typeof updateCameraToggleUI === 'function') return updateCameraToggleUI();
        return undefined;
    }

    async function runTogglePushNotifications(...args) {
        if (typeof togglePushNotifications === 'function') {
            return togglePushNotifications(...args);
        }
        return undefined;
    }

    return {
        PERMISSION_TYPES,
        getPermissionState,
        requestPermission: runRequestPermission,
        openAppSettings: runOpenAppSettings,
        updateCameraToggleUI: runUpdateCameraToggleUI,
        togglePushNotifications: runTogglePushNotifications,
    };
}

export { PERMISSION_TYPES };
