'use client';

import { useEffect, useRef, useState } from 'react';

interface UseViewportActivationOptions {
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
  timeoutMs?: number;
}

export function useViewportActivation<T extends HTMLElement = HTMLElement>({
  enabled = true,
  rootMargin = '600px 0px',
  threshold = 0,
  timeoutMs = 8000,
}: UseViewportActivationOptions = {}) {
  const ref = useRef<T | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [prevEnabled, setPrevEnabled] = useState(enabled);

  // Reset during render when the `enabled` prop flips off, instead of routing
  // the adjustment through an effect (avoids a stale-frame commit).
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (!enabled && isActive) {
      setIsActive(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // One-shot activation: the subscription tears itself down the moment it
    // fires, so the effect never re-runs in response to its own state update.
    let finished = false;
    let observer: IntersectionObserver | undefined;
    let timeoutId: number | undefined;

    const activate = () => {
      if (finished) {
        return;
      }
      finished = true;
      observer?.disconnect();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      setIsActive(true);
    };

    if (typeof window.IntersectionObserver !== 'function') {
      // Activate asynchronously so the effect never sets state synchronously.
      timeoutId = window.setTimeout(activate, 0);
      return () => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
        }
      },
      { rootMargin, threshold }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    timeoutId =
      timeoutMs > 0 ? window.setTimeout(activate, timeoutMs) : undefined;

    return () => {
      observer?.disconnect();

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, rootMargin, threshold, timeoutMs]);

  return { ref, isActive };
}
