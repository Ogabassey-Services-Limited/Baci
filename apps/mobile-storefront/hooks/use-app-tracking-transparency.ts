import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import {
  canRequestTrackingTransparency,
  getTrackingPermissionStatus,
} from '@/lib/tracking-transparency';
import { requestTrackingPermission } from '@/services/ad-tracking';
import { trackEvent } from '@/services/analytics';

interface UseAppTrackingTransparencyOptions {
  enabled: boolean;
}

interface UseAppTrackingTransparencyResult {
  isTrackingAuthorizationSettled: boolean;
}

function recordAttLifecycleEvent(
  eventName: string,
  breadcrumbName: string,
  properties?: Record<string, string>
) {
  try {
    recordCrashBreadcrumb(breadcrumbName, properties);
  } catch {
    // Observability must never block the native permission request.
  }

  try {
    trackEvent(eventName, properties);
  } catch {
    // Analytics may not be ready when the first visible frame appears.
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

      recordAttLifecycleEvent('ATT Request Started', 'att:request_started');

      try {
        const status = await requestTrackingPermission();
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Result', 'att:request_result', {
          status,
        });
      } catch {
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Error', 'att:request_error', {
          stage: 'request',
        });
      } finally {
        settle();
      }
    };

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
        recordAttLifecycleEvent('ATT Status Checked', 'att:status_checked', {
          status,
        });

        if (status !== 'undetermined') {
          settle();
          return;
        }

        requestWhenActive();
      } catch {
        if (cancelled) return;
        recordAttLifecycleEvent('ATT Request Error', 'att:request_error', {
          stage: 'status',
        });
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
