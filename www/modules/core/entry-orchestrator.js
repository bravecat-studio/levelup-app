export function initAppEntryOrchestrator({
    onDomReady,
    onAuthStateChanged,
    auth,
    handleAuthStateChanged,
    startIntervals,
    onReadyError,
}) {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            if (typeof onDomReady === 'function') {
                await onDomReady();
            }

            if (typeof onAuthStateChanged === 'function' && auth && typeof handleAuthStateChanged === 'function') {
                onAuthStateChanged(auth, async (user) => {
                    await handleAuthStateChanged(user);
                });
            }

            if (typeof startIntervals === 'function') {
                startIntervals();
            }
        } catch (error) {
            if (typeof onReadyError === 'function') {
                onReadyError(error);
            } else {
                console.error('[EntryOrchestrator] DOMContentLoaded init failed:', error);
            }
        }
    });
}
