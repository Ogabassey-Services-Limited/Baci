'use client';

import type React from 'react';
import { startTransition, useEffect, useState } from 'react';

interface DeferredShellFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeoutMs?: number;
  enabled?: boolean;
  activateOnIdle?: boolean;
  activateOnInteraction?: boolean;
  deferInteractionActivationUntilNextPaint?: boolean;
}

export function useDeferredActivation({
  timeoutMs = 2000,
  enabled = true,
  activateOnIdle = true,
  activateOnInteraction = true,
  deferInteractionActivationUntilNextPaint = false,
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
    let interactionFrameId: number | undefined;
    let interactionTimeoutId: number | undefined;
    let interactionActivationScheduled = false;
    let loadListenerAttached = false;
    const activate = () => {
      if (!cancelled) {
        setIsActivated(true);
      }
    };
    const activateAsTransition = () => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        if (!cancelled) {
          setIsActivated(true);
        }
      });
    };
    const schedulePostPaintInteractionActivation = () => {
      if (cancelled || interactionActivationScheduled) {
        return;
      }

      interactionActivationScheduled = true;

      const activateAfterPaint = () => {
        if (cancelled) {
          return;
        }

        interactionFrameId = undefined;
        interactionTimeoutId = window.setTimeout(() => {
          interactionTimeoutId = undefined;
          activateAsTransition();
        }, 0);
      };

      if (typeof window.requestAnimationFrame === 'function') {
        interactionFrameId = window.requestAnimationFrame(activateAfterPaint);
        return;
      }

      interactionTimeoutId = window.setTimeout(() => {
        interactionTimeoutId = undefined;
        activateAsTransition();
      }, 0);
    };
    const handleInteraction = () => {
      if (deferInteractionActivationUntilNextPaint) {
        schedulePostPaintInteractionActivation();
        return;
      }

      activate();
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
      window.addEventListener('pointerdown', handleInteraction, {
        once: true,
        passive: true,
      });
      window.addEventListener('keydown', handleInteraction, { once: true });
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

      if (interactionFrameId !== undefined) {
        window.cancelAnimationFrame(interactionFrameId);
      }

      if (interactionTimeoutId !== undefined) {
        window.clearTimeout(interactionTimeoutId);
      }

      if (loadListenerAttached) {
        window.removeEventListener('load', handleWindowLoad);
      }

      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [
    activateOnIdle,
    activateOnInteraction,
    deferInteractionActivationUntilNextPaint,
    enabled,
    isActivated,
    timeoutMs,
  ]);

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
