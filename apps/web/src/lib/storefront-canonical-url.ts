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
 */
export function normalizeStorefrontCanonicalUrl(
  canonicalUrl: string | null | undefined,
  baseUrl: string
): string | undefined {
  const normalizedCanonical = canonicalUrl?.trim();
  if (!normalizedCanonical) {
    return undefined;
  }

  try {
    const storeOrigin = new URL(baseUrl).origin;
    const canonical = new URL(normalizedCanonical, baseUrl);

    if (canonical.origin !== storeOrigin) {
      const rewritten = new URL(storeOrigin);
      rewritten.pathname = canonical.pathname;
      rewritten.search = canonical.search;
      rewritten.hash = canonical.hash;
      return rewritten.toString();
    }

    return canonical.toString();
  } catch {
    return undefined;
  }
}
