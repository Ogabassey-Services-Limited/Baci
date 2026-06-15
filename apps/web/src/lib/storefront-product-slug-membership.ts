interface SlugMissingOptions {
  /**
   * Public request origin, e.g. `https://ogabassey.com` — used as the fallback
   * fetch base only. When the platform host (`VERCEL_URL`) is available the
   * internal call routes through it instead, so a custom domain does not pay an
   * extra DNS/TLS handshake on every PDP navigation.
   */
  origin: string;
  /** Storefront slug or custom domain the proxy has (resolved by the route). */
  identifier: string;
  /** The product slug from the PDP path (`/{category}/{productSlug}`). */
  productSlug: string;
  /** `INTERNAL_API_SECRET`; when absent the check fails open. */
  secret: string | undefined;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Tight budget — a slow internal hop must not delay navigations. */
  timeoutMs?: number;
}

/**
 * Resolve the base URL for the internal membership hop. The route resolves the
 * merchant from the `identifier` PATH param (not the Host header), so the call
 * is host-agnostic — we prefer the platform deployment host (`VERCEL_URL`) to
 * avoid resolving/handshaking the merchant's custom domain on every PDP nav,
 * and fall back to the public origin locally (where `VERCEL_URL` is unset).
 */
function resolveInternalBaseUrl(origin: string): string {
  const platformHost = process.env.VERCEL_URL;
  return platformHost ? `https://${platformHost}` : origin;
}

/**
 * Returns TRUE only when we POSITIVELY confirm the product slug exists for no
 * product of this merchant (a true typo → the proxy may hard-404 it).
 *
 * Delegates the membership decision to the internal route (which can legally
 * call the `'use cache'` slug-set builder the proxy cannot) and reads back only
 * `{ hasError, present }` — never the full slug list — so a large catalog adds
 * no slug-list transfer/parse to the navigation.
 *
 * Fail-open by construction: a missing secret, non-2xx, transport error,
 * timeout, `hasError`, or a non-`false` `present` all return FALSE so the proxy
 * never hard-404s a live product on a stale/unavailable set.
 */
export async function isStorefrontProductSlugMissing(
  opts: SlugMissingOptions
): Promise<boolean> {
  if (!opts.secret) {
    return false;
  }

  try {
    const url = new URL(
      `/api/internal/slug-set/${encodeURIComponent(opts.identifier)}`,
      resolveInternalBaseUrl(opts.origin)
    );
    url.searchParams.set('slug', opts.productSlug);

    const response = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.secret}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 800),
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as {
      hasError?: boolean;
      present?: boolean;
    };

    // Hard-404 ONLY on an explicit, error-free "absent" verdict. Any other
    // shape (hasError, present true/undefined, malformed) falls through.
    return body?.hasError === false && body?.present === false;
  } catch {
    return false;
  }
}
