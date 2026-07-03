import { getCloudflareApiToken, getCloudflareZoneId } from '@/env';

/**
 * Best-effort Cloudflare edge cache purge for the storefront custom domains.
 *
 * Cloudflare sits in front of the storefront (ogabassey.com → Vercel), so a
 * longer edge TTL only stays correct if we actively evict mutated URLs. This
 * helper is called fire-and-forget from the revalidation path; it MUST NEVER
 * throw or reject in a way that breaks the caller — a purge failure is always
 * survivable because caches self-heal on their `stale-while-revalidate` TTL.
 *
 * Fail-open contract:
 *   - Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID → warn once, no-op.
 *   - Network error / non-2xx response → warn (not once) and continue.
 */

const CLOUDFLARE_PURGE_API_BASE = 'https://api.cloudflare.com/client/v4/zones';
// Cloudflare's single-file purge endpoint accepts at most 30 URLs per request
// on non-Enterprise plans; larger lists are chunked into sequential requests.
const MAX_URLS_PER_BATCH = 30;
const DEFAULT_PURGE_TIMEOUT_MS = 5000;

let hasWarnedMissingConfig = false;

function warnMissingConfigOnce(): void {
  if (hasWarnedMissingConfig) {
    return;
  }
  hasWarnedMissingConfig = true;
  console.warn(
    'Cloudflare cache purge skipped: CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ZONE_ID are not configured. Edge caches will self-heal on their TTL.'
  );
}

function chunkUrls(urls: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < urls.length; index += size) {
    batches.push(urls.slice(index, index + size));
  }
  return batches;
}

export interface PurgeCloudflareUrlsOptions {
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Purge the given absolute URLs from Cloudflare's edge cache.
 * Silently no-ops on empty input or missing configuration, and swallows all
 * network/API errors so a purge failure never propagates to the caller.
 */
export async function purgeCloudflareUrls(
  urls: string[],
  options: PurgeCloudflareUrlsOptions = {}
): Promise<void> {
  const uniqueUrls = Array.from(
    new Set(
      urls.filter(
        (url): url is string => typeof url === 'string' && url.length > 0
      )
    )
  );
  if (uniqueUrls.length === 0) {
    return;
  }

  const token = getCloudflareApiToken();
  const zoneId = getCloudflareZoneId();
  if (!token || !zoneId) {
    warnMissingConfigOnce();
    return;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${CLOUDFLARE_PURGE_API_BASE}/${encodeURIComponent(
    zoneId
  )}/purge_cache`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PURGE_TIMEOUT_MS;

  for (const batch of chunkUrls(uniqueUrls, MAX_URLS_PER_BATCH)) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: batch }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        console.warn(
          'Cloudflare cache purge returned a non-2xx response; relying on TTL self-heal',
          { status: response.status, count: batch.length }
        );
      }
    } catch (error) {
      console.warn(
        'Cloudflare cache purge request failed; relying on TTL self-heal',
        { error, count: batch.length }
      );
    }
  }
}
