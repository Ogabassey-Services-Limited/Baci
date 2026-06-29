import { fetchWithCsrf } from '@/lib/api-client';

const LOGIN_STARTED_TRACKING_TIMEOUT_MS = 750;

export async function waitForReceiptClaimLoginStartedTrackingWindow(
  token: string
) {
  if (!token) {
    return;
  }

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    await Promise.race([
      fetchWithCsrf(
        `/api/storefront/receipts/claims/${encodeURIComponent(token)}/login-email`,
        {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          keepalive: true,
          method: 'POST',
        }
      ).catch(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = globalThis.setTimeout(
          resolve,
          LOGIN_STARTED_TRACKING_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
