'use client';

import { useEffect } from 'react';

/**
 * Client component to initialize CSRF token on app load.
 * Retries once after a short delay if the initial fetch fails
 * (handles transient timing during dev server startup).
 */
export function CsrfInitializer() {
  useEffect(() => {
    let cancelled = false;

    async function initCsrf(retries = 1) {
      try {
        const response = await fetch('/api/csrf');
        if (!response.ok && retries > 0 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          if (!cancelled) return initCsrf(retries - 1);
        }
      } catch {
        if (retries > 0 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          if (!cancelled) return initCsrf(retries - 1);
        }
      }
    }

    initCsrf();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
