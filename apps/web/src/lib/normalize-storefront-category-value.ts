/**
 * Normalize a storefront category value into a slug-safe token.
 *
 * Trims whitespace, lowercases, removes diacritics, replaces non-alphanumeric
 * separators with a single `-`, trims edge hyphens, and returns `null` when no
 * usable token remains.
 *
 * Example: `" Product & News "` -> `"product-news"`.
 */
export function normalizeStorefrontCategoryValue(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || null;
}
