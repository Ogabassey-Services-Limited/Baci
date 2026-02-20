const EDGE_CONFIG_SYNC_PATH = '/api/edge-config/sync';

function getSyncOrigin(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/+$/, '');
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const normalizedVercelUrl = vercelUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    return `https://${normalizedVercelUrl}`;
  }

  // Avoid noisy local-development failures when no public URL is configured.
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().replace(
    /[\r\n]/g,
    ''
  );

  if (!rootDomain) {
    throw new Error(
      'NEXT_PUBLIC_ROOT_DOMAIN must be configured in production for Edge Config sync origin resolution.'
    );
  }

  return `https://${rootDomain}`;
}

/**
 * Best-effort trigger to refresh Vercel Edge Config domain mappings.
 * Failures are logged but never thrown to avoid breaking user flows.
 */
export async function triggerDomainEdgeConfigSync(): Promise<void> {
  const authToken = process.env.EDGE_CONFIG_SYNC_SECRET?.trim().replace(
    /[\r\n]/g,
    ''
  );
  if (!authToken) {
    if (process.env.VERCEL_API_TOKEN) {
      console.warn(
        '[Edge Config Sync Trigger] EDGE_CONFIG_SYNC_SECRET is missing; VERCEL_API_TOKEN fallback is no longer used.'
      );
    }
    return;
  }

  try {
    const origin = getSyncOrigin();
    if (!origin) return;

    const syncUrl = `${origin}${EDGE_CONFIG_SYNC_PATH}`;

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error('[Edge Config Sync Trigger] Failed to sync', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    console.error('[Edge Config Sync Trigger] Sync request failed', {
      error,
    });
  }
}
