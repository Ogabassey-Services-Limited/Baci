/**
 * Longest category slug the STOREFRONT can actually read.
 *
 * Not an arbitrary API limit: the public read RPCs reject a longer value
 * outright — `octet_length(p_category_slug) > 64` in
 * `20260709213000_bounded_storefront_cluster_guide_candidates.sql:108` and the
 * same bound on `raw_input.category_slug` in
 * `20260710123000_storefront_public_read_snapshots.sql:1029`. Allowing more
 * would let a merchant create a category the storefront cannot serve.
 *
 * Bytes, not characters — but the slug alphabet is `[a-z0-9-]`, so one
 * character is one byte and the two bounds coincide.
 */
export const MAX_CATEGORY_SLUG_LENGTH = 64;

/**
 * Longest category NAME the API accepts, shared so the mobile input and the
 * server schema cannot disagree. The mobile hook previously allowed 200, so a
 * 161–200 character name passed every local check and then failed with an API
 * 400 the merchant could not have predicted.
 */
export const MAX_CATEGORY_NAME_LENGTH = 160;

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
