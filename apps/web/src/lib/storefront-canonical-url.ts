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
