'use client';

import type React from 'react';
import { useEffect, useState } from 'react';

interface DeferredShellFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeoutMs?: number;
  enabled?: boolean;
  activateOnIdle?: boolean;
  activateOnInteraction?: boolean;
}

export function useDeferredActivation({
  timeoutMs = 2000,
  enabled = true,
  activateOnIdle = true,
  activateOnInteraction = true,
}: Omit<DeferredShellFeatureProps, 'children'>) {
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsActivated(false);
      return;
    }

    if (isActivated) {
      return;
    }

    let cancelled = false;
    let idleCallbackId: number | undefined;
    let loadListenerAttached = false;
    const activate = () => {
      if (!cancelled) {
        setIsActivated(true);
      }
    };

    const scheduleIdleActivation = () => {
      if (cancelled || !activateOnIdle || idleCallbackId !== undefined) {
        return;
      }

      if (typeof window.requestIdleCallback === 'function') {
        idleCallbackId = window.requestIdleCallback(activate, {
          timeout: timeoutMs || 1000,
        });
        return;
      }

      idleCallbackId = window.setTimeout(activate, 0);
    };

    const handleWindowLoad = () => {
      window.removeEventListener('load', handleWindowLoad);
      loadListenerAttached = false;
      scheduleIdleActivation();
    };

    const timeoutId =
      timeoutMs > 0 ? window.setTimeout(activate, timeoutMs) : undefined;

    if (activateOnIdle) {
      if (document.readyState === 'complete') {
        scheduleIdleActivation();
      } else {
        loadListenerAttached = true;
        window.addEventListener('load', handleWindowLoad, { once: true });
      }
    }

    if (activateOnInteraction) {
      window.addEventListener('pointerdown', activate, {
        once: true,
        passive: true,
      });
      window.addEventListener('keydown', activate, { once: true });
      window.addEventListener('scroll', activate, {
        once: true,
        passive: true,
      });
    }

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      if (idleCallbackId !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleCallbackId);
        } else {
          window.clearTimeout(idleCallbackId);
        }
      }

      if (loadListenerAttached) {
        window.removeEventListener('load', handleWindowLoad);
      }

      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      window.removeEventListener('scroll', activate);
    };
  }, [activateOnIdle, activateOnInteraction, enabled, isActivated, timeoutMs]);

  return isActivated;
}

export function DeferredShellFeature({
  children,
  fallback = null,
  ...options
}: DeferredShellFeatureProps) {
  const isActivated = useDeferredActivation(options);

  if (!isActivated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
