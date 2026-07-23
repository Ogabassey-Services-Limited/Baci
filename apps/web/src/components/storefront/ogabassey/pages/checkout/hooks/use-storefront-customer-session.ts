'use client';

import { useEffect, useState } from 'react';

interface StorefrontSessionResponse {
  authenticated?: boolean;
}

async function fetchSessionAuthenticated(
  merchantSlug: string,
  signal: AbortSignal
): Promise<boolean> {
  const response = await fetch(
    `/api/storefront/auth/session?merchantSlug=${encodeURIComponent(merchantSlug)}`,
    { signal }
  );
  if (!response.ok) {
    return false;
  }
  const data = (await response.json()) as StorefrontSessionResponse | null;
  return Boolean(data?.authenticated);
}

// Module scope so the try/catch stays out of the effect body, where it would
// otherwise block React Compiler memoization (same pattern as the sibling
// polling hook).
async function loadSessionAuthenticated(
  merchantSlug: string,
  signal: AbortSignal,
  setIsAuthenticated: (value: boolean) => void
) {
  try {
    const authenticated = await fetchSessionAuthenticated(merchantSlug, signal);
    if (!signal.aborted) {
      setIsAuthenticated(authenticated);
    }
  } catch {
    if (!signal.aborted) {
      setIsAuthenticated(false);
    }
  }
}

/**
 * Resolves whether a storefront customer is signed in on routes that do NOT
 * mount `CustomerAuthProvider` — the `(commerce)` checkout route is one, so
 * `useAuthSafe()`/`useCustomerAuth()` are both null there. Mirrors the storefront
 * header, which reads the cookie session directly via `/api/storefront/auth/session`.
 *
 * This is the correct client-side gate source for the wallet-funded transfer
 * flow: the intent API remains the real authority (it 401/409s guests), so a
 * stale `false` only defers to the legacy order-DVA path — it never claims payment.
 */
export function useStorefrontCustomerSession(merchantSlug: string | undefined): {
  isAuthenticated: boolean;
} {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!merchantSlug) {
      setIsAuthenticated(false);
      return;
    }
    const controller = new AbortController();
    void loadSessionAuthenticated(
      merchantSlug,
      controller.signal,
      setIsAuthenticated
    );
    return () => controller.abort();
  }, [merchantSlug]);

  return { isAuthenticated };
}
