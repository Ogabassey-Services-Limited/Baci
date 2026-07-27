import { after } from 'next/server';
import { getAppUrl, getInternalApiSecret } from '@/env';
import { logger } from '@/lib/logger';

interface InternalStorefrontPurgeBridgeOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  secret?: string;
  timeoutMs?: number;
}

interface ResolvedStorefrontPurgeInput {
  merchantId: string;
  merchantSlug: string;
}

async function requestWholeStorefrontPurge(
  { merchantId, merchantSlug }: ResolvedStorefrontPurgeInput,
  options: InternalStorefrontPurgeBridgeOptions
): Promise<void> {
  const secret = options.secret ?? getInternalApiSecret();
  if (!secret) {
    logger.error({
      message: 'Skipped internal storefront purge bridge: missing secret',
      merchantId,
    });
    return;
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      new URL(
        '/api/internal/revalidate-products',
        options.baseUrl ?? getAppUrl()
      ),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId,
          merchantSlug,
          purgeWholeStorefront: true,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      }
    );
    if (!response.ok) {
      logger.error({
        message: 'Internal storefront purge bridge returned non-2xx',
        merchantId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Internal storefront purge bridge request failed',
      merchantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Schedule a bearer-authenticated request to the internal revalidation route.
 *
 * Category routes deliberately use this bridge instead of importing the
 * Cloudflare client: the internal route is the narrow server-only authority
 * that owns hostname-wide edge purges. The category mutation has already
 * committed when this runs, so transport failures are logged and never surface
 * as a misleading client error.
 */
export function scheduleInternalStorefrontPurge(
  merchantIdInput: string,
  merchantSlugInput: string | null | undefined,
  options: InternalStorefrontPurgeBridgeOptions = {}
): void {
  const merchantId = merchantIdInput.trim();
  const merchantSlug = merchantSlugInput?.trim();
  if (!merchantId || !merchantSlug) {
    return;
  }

  const request = () =>
    requestWholeStorefrontPurge({ merchantId, merchantSlug }, options);
  try {
    after(request);
  } catch {
    // Background workers and unit tests have no request scope. Preserve the
    // same best-effort behavior without delaying or failing the mutation.
    void request();
  }
}
