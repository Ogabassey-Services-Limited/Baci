type MobileUpdateCheckReason = 'foreground' | 'initial' | 'push-notification';
type MobileUpdateListener = (reason: MobileUpdateCheckReason) => void;

const listeners = new Set<MobileUpdateListener>();

export function requestMobileUpdateCheck(reason: MobileUpdateCheckReason) {
  for (const listener of listeners) {
    listener(reason);
  }
}

export function subscribeToMobileUpdateChecks(listener: MobileUpdateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
