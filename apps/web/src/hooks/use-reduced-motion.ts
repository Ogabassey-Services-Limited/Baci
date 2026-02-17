'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitialValue(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Hook to detect if the user prefers reduced motion.
 * Uses a lazy initializer so the first render reflects the user's preference
 * without a one-frame flash.
 */
export function useReducedMotion() {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(getInitialValue);

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);

    const listener = (event: MediaQueryListEvent) => {
      setShouldReduceMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return shouldReduceMotion;
}
