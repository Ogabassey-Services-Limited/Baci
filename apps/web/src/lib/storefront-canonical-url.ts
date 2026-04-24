/**
 * Canonicalize a category slug for storefront routing.
 *
 * Unlike `normalizeStorefrontCategoryValue`, which performs aggressive
 * slugification (diacritic stripping, non-alphanumeric → `-`, etc.) designed
 * for free-text category names, this helper preserves the merchant-defined
 * slug shape and only trims whitespace and lowercases the value. This matches
 * how slugs are stored and queried in `products.category_slug`, so the token
 * produced here is safe to use both as a Map key for deduplication and in
 * routing/link destinations.
 *
 * Returns `null` when the input is empty/whitespace-only so callers can skip
 * rendering broken links.
 */
export function canonicalizeCategorySlug(
  slug: string | null | undefined
): string | null {
  const normalized = slug?.trim().toLowerCase();
  return normalized || null;
}

/**
 * Normalizes a storefront canonical URL by ensuring it points to the correct storefront origin.
 * If the canonical URL host differs from the storefront base URL host, it rewrites the origin
 * while preserving the pathname, search parameters, and hash.
 *
 * @param canonicalUrl The raw canonical URL string from the database/product
 * @param baseUrl The base URL of the current storefront (e.g., https://ogabassey.com)
 * @param merchantSlug Optional merchant slug. When provided, any leading
 *   `/<merchantSlug>` segment in the canonical path is stripped so custom
 *   domains emit final canonicals without the merchant prefix. Callers that
 *   omit this will skip prefix stripping, which can leave stale merchant-
 *   prefixed paths in the output for custom-domain storefronts.
 */
export function normalizeStorefrontCanonicalUrl(
  canonicalUrl: string | null | undefined,
  baseUrl: string,
  merchantSlug?: string | null
): string | undefined {
  const normalizedCanonical = canonicalUrl?.trim();
  if (!normalizedCanonical) {
    return undefined;
  }

  // Parse baseUrl first so a malformed storefront origin does not fall through
  // to returning the raw canonical input (which may be a relative path that is
  // not a valid absolute canonical URL for SEO). If the storefront baseUrl is
  // unusable we return `undefined` and let the caller fall back to its own
  // origin construction.
  let storeOrigin: string;
  try {
    storeOrigin = new URL(baseUrl).origin;
  } catch {
    return undefined;
  }

  try {
    const canonical = new URL(normalizedCanonical, baseUrl);

    // Always evaluate merchant-prefix stripping, regardless of whether the
    // canonical origin already matches the storefront origin. Relative inputs
    // (e.g. `/ogabassey/products/iphone-15`) resolve to the same origin as
    // `baseUrl` and would otherwise bypass the stripping branch, producing
    // non-final canonicals on custom domains that the proxy then redirects.
    const normalizedMerchantSlug = merchantSlug?.trim().toLowerCase();
    const canonicalPathSegments = canonical.pathname.split('/').filter(Boolean);
    const shouldStripMerchantPrefix = Boolean(
      normalizedMerchantSlug &&
        canonicalPathSegments.length > 0 &&
        canonicalPathSegments[0]?.toLowerCase() === normalizedMerchantSlug
    );
    const rewrittenPathname = shouldStripMerchantPrefix
      ? canonicalPathSegments.length === 1
        ? '/'
        : `/${canonicalPathSegments.slice(1).join('/')}`
      : canonical.pathname;
    const normalizedPathname =
      shouldStripMerchantPrefix &&
      rewrittenPathname !== '/' &&
      canonical.pathname.endsWith('/')
        ? `${rewrittenPathname}/`
        : rewrittenPathname;

    if (canonical.origin !== storeOrigin || shouldStripMerchantPrefix) {
      return `${storeOrigin}${normalizedPathname}${canonical.search}${canonical.hash}`;
    }

    return canonical.toString();
  } catch {
    return undefined;
  }
}
