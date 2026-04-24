export function normalizeStorefrontCategorySlug(
  slug: string | null | undefined
): string | null {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  // Only correct obvious legacy/typo slugs. Brand-specific slugs like
  // `samsung` or `macbook` are intentionally NOT remapped here because
  // merchants may legitimately configure them as their category slugs;
  // rewriting those would point storefront links at `/smartphones` or
  // `/laptops`, which those merchants do not serve. Brand-scoped alias
  // normalization should live in explicit legacy URL flows only.
  switch (normalized) {
    case 'accesories':
      return 'accessories';
    case 'phone':
    case 'phones':
      return 'smartphones';
    case 'laptop':
      return 'laptops';
    default:
      return normalized;
  }
}
