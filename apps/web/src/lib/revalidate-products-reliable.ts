import { getAppUrl, getInternalApiSecret } from '@/env';
import { revalidateProducts } from '@/lib/cache-revalidation';

interface RevalidateProductsReliableOptions {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Override the app base URL (defaults to `getAppUrl()`). */
  baseUrl?: string;
  /** Override the internal secret (defaults to `getInternalApiSecret()`). */
  secret?: string;
  /** HTTP fallback timeout. */
  timeoutMs?: number;
}

/**
 * Revalidate a merchant's product caches reliably from ANY execution context.
 *
 * - In a Next request/store context (route handlers, the import cron route),
 *   the in-process `revalidateProducts` (`revalidateTag`) works directly.
 * - In a standalone worker (the import CLI, `scripts/process-import-jobs.ts`)
 *   there is NO store context, so `revalidateTag` throws. We fall back to POSTing
 *   the internal `/api/internal/revalidate-products` endpoint (Bearer-authed),
 *   which DOES run in a route context — giving reliable invalidation of the
 *   proxy crawl-budget `product-slug-set` so freshly imported products are not
 *   hard-404ed while a stale set is cached.
 *
 * Fail-safe: never throws. If the in-process call fails AND the HTTP fallback is
 * unavailable/errors, the slug-set still self-heals on its cacheLife TTL — this
 * just makes the common case prompt and reliable.
 */
export async function revalidateProductsReliable(
  merchantId: string,
  options: RevalidateProductsReliableOptions = {}
): Promise<void> {
  try {
    revalidateProducts(merchantId);
    return; // In-process revalidation succeeded (we had a Next store context).
  } catch {
    // No store context (standalone worker) — fall back to the HTTP endpoint.
  }

  const secret = options.secret ?? getInternalApiSecret();
  // The HTTP fallback only runs in the standalone import worker, whose env
  // convention for the web origin is BACI_WEB_BASE_URL (see vps-workers/README;
  // already required + https-validated for the cron calls) — NOT
  // NEXT_PUBLIC_APP_URL, which is unset there (getAppUrl would return localhost).
  // Fall back to getAppUrl() only for non-worker/dev callers.
  const baseUrl =
    options.baseUrl ?? process.env.BACI_WEB_BASE_URL ?? getAppUrl();
  if (!secret || !baseUrl) {
    console.error(
      'Reliable product revalidation unavailable (missing secret/baseUrl); relying on cacheLife self-heal',
      { merchantId }
    );
    return;
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      new URL('/api/internal/revalidate-products', baseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchantId }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      }
    );
    if (!response.ok) {
      console.error(
        'Internal product revalidation endpoint returned non-2xx; relying on cacheLife self-heal',
        { merchantId, status: response.status }
      );
    }
  } catch (error) {
    console.error(
      'Internal product revalidation request failed; relying on cacheLife self-heal',
      { merchantId, error }
    );
  }
}
