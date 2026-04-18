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

  useEffect(() => {
    if (!enabled) {
      setIsActive(false);
      return;
    }

    if (isActive) {
      return;
    }

    const activate = () => {
      setIsActive(true);
    };

    if (typeof window.IntersectionObserver !== 'function') {
      activate();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    const timeoutId =
      timeoutMs > 0 ? window.setTimeout(activate, timeoutMs) : undefined;

    return () => {
      observer.disconnect();

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, isActive, rootMargin, threshold, timeoutMs]);

  return { ref, isActive };
}
