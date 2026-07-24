import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  canRequestTrackingTransparency,
  getTrackingPermissionStatus,
  requestTrackingPermissionStatus,
} from '@/lib/tracking-transparency';
import { getAdminPostHog } from '@/services/analytics-core';

interface UseAppTrackingTransparencyOptions {
  enabled: boolean;
}

interface UseAppTrackingTransparencyResult {
  isTrackingAuthorizationSettled: boolean;
}

function recordAttLifecycleEvent(
  eventName: string,
  properties?: Record<string, string>
) {
  try {
    getAdminPostHog()?.capture(eventName, properties);
  } catch {
    // Analytics may not be ready when the first visible frame appears, and
    // observability must never block the native permission request.
  }
}

export function useAppTrackingTransparency({
  enabled,
}: UseAppTrackingTransparencyOptions): UseAppTrackingTransparencyResult {
  const [isTrackingAuthorizationSettled, setIsTrackingAuthorizationSettled] =
    useState(() => !canRequestTrackingTransparency());
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (
      !enabled ||
      isTrackingAuthorizationSettled ||
      hasStartedRef.current ||
      !canRequestTrackingTransparency()
    ) {
      return;
    }

    hasStartedRef.current = true;
    let cancelled = false;
    let appStateSubscription: ReturnType<
      typeof AppState.addEventListener
    > | null = null;

    const settle = () => {
      if (!cancelled) {
        setIsTrackingAuthorizationSettled(true);
      }
    };

    const requestAuthorization = async () => {
      if (cancelled) return;

      recordAttLifecycleEvent('ATT Request Started');

      try {
        const { status } = await requestTrackingPermissionStatus();
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Result', { status });
      } catch {
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Error', { stage: 'request' });
      } finally {
        settle();
      }
    };

    // iOS silently resolves ATT requests made while the app is not active,
    // so the prompt must wait for the foreground-active transition.
    const requestWhenActive = () => {
      if (cancelled) return;
      if (AppState.currentState === 'active') {
        void requestAuthorization();
        return;
      }

      appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        appStateSubscription?.remove();
        appStateSubscription = null;
        void requestAuthorization();
      });
    };

    const checkStatus = async () => {
      try {
        const { status } = await getTrackingPermissionStatus();
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Status Checked', { status });

        if (status !== 'undetermined') {
          settle();
          return;
        }

        requestWhenActive();
      } catch {
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Error', { stage: 'status' });
        settle();
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
      hasStartedRef.current = false;
      appStateSubscription?.remove();
    };
  }, [enabled, isTrackingAuthorizationSettled]);

  return { isTrackingAuthorizationSettled };
}
