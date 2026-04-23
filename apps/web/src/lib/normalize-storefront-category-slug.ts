export function normalizeStorefrontCategorySlug(
  slug: string | null | undefined
): string | null {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

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
