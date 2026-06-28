type MobileUpdateCheckReason = 'foreground' | 'initial' | 'push-notification';
type MobileUpdateListener = (reason: MobileUpdateCheckReason) => void;

const listeners = new Set<MobileUpdateListener>();

export function requestMobileUpdateCheck(reason: MobileUpdateCheckReason) {
  for (const listener of [...listeners]) {
    try {
      listener(reason);
    } catch (error) {
      if (__DEV__) {
        console.warn('[mobile-update-events] listener failed', error);
      }
    }
  }
}

export function subscribeToMobileUpdateChecks(listener: MobileUpdateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
