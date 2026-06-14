interface SlugMissingOptions {
  /** Request origin, e.g. `https://ogabassey.com`. */
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
 * Returns TRUE only when we POSITIVELY confirm the product slug exists for no
 * product of this merchant (a true typo → the proxy may hard-404 it).
 *
 * Fail-open by construction: a missing secret, non-2xx, transport error,
 * timeout, `hasError`, or an empty slug set all return FALSE so the proxy never
 * hard-404s a live product on a stale/unavailable set. Comparison is
 * case-insensitive so a case-mismatched slug falls through to the page's
 * existing canonical 308 rather than being 404'd here.
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
      opts.origin
    );

    const response = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${opts.secret}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 800),
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as {
      hasError?: boolean;
      slugs?: unknown;
    };

    if (
      !body ||
      body.hasError ||
      !Array.isArray(body.slugs) ||
      body.slugs.length === 0
    ) {
      return false;
    }

    const slugSet = new Set(
      body.slugs
        .filter((slug): slug is string => typeof slug === 'string')
        .map((slug) => slug.toLowerCase())
    );

    return !slugSet.has(opts.productSlug.toLowerCase());
  } catch {
    return false;
  }
}
