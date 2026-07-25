/**
 * Longest slug the category API accepts. Kept in step with
 * `apps/web/src/schemas/category-slug.ts`.
 */
export const MAX_CATEGORY_SLUG_LENGTH = 120;

/**
 * Derive a storefront-safe category slug from a merchant-typed name.
 *
 * Shared because the mobile admin generates the slug client-side while the web
 * API validates it: two independent normalizations drift, and the merchant
 * only finds out via a 400. This produces exactly what `categorySlugSchema`
 * accepts — lowercase alphanumeric words joined by single dashes, at most
 * `MAX_CATEGORY_SLUG_LENGTH` characters.
 *
 * Returns `null` when the name yields nothing usable — a name written entirely
 * in a non-Latin script (`手机`) or only in punctuation has no ASCII slug, and
 * silently inventing one would give the merchant a URL unrelated to what they
 * typed. Callers must surface that as "choose a name containing letters or
 * numbers" rather than submitting an empty slug.
 *
 * Accented Latin is transliterated rather than dropped, so "Téléphones"
 * becomes `telephones` instead of `t-l-phones`.
 */
export function deriveCategorySlug(name: string): string | null {
  const slug = name
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD (é -> e + U+0301).
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length === 0) {
    return null;
  }
  if (slug.length <= MAX_CATEGORY_SLUG_LENGTH) {
    return slug;
  }

  // Truncate on a word boundary so the slug never ends mid-word or on a dash.
  const truncated = slug.slice(0, MAX_CATEGORY_SLUG_LENGTH);
  const lastDash = truncated.lastIndexOf('-');
  const trimmed = lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
  return trimmed.replace(/-+$/g, '');
}
