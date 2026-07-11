import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  canRequestTrackingTransparency,
  getTrackingPermissionStatus,
} from '@/lib/tracking-transparency';
import { requestTrackingPermission } from '@/services/ad-tracking';

const HOME_TRACKING_PROMPT_DELAY_MS = 3000;

export function useHomePermissionPrompt() {
  useEffect(() => {
    if (!canRequestTrackingTransparency()) return;

    let cancelled = false;
    let requestStarted = false;
    let appStateSubscription: ReturnType<
      typeof AppState.addEventListener
    > | null = null;

    const requestIfUndetermined = async () => {
      if (cancelled || requestStarted) return;

      try {
        const { status } = await getTrackingPermissionStatus();
        if (cancelled || status !== 'undetermined') return;

        requestStarted = true;
        await requestTrackingPermission();
      } catch {
        // Fail closed. Advertising tracking stays disabled when ATT is unreadable.
      }
    };

    const requestWhenActive = () => {
      if (AppState.currentState === 'active') {
        void requestIfUndetermined();
        return;
      }

      appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        appStateSubscription?.remove();
        appStateSubscription = null;
        void requestIfUndetermined();
      });
    };

    // Present Apple's ATT prompt after storefront content is visible.
    const timerId = setTimeout(
      requestWhenActive,
      HOME_TRACKING_PROMPT_DELAY_MS
    );

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      appStateSubscription?.remove();
    };
  }, []);
}
