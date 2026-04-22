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
    case 'samsung':
      return 'smartphones';
    case 'laptop':
    case 'macbook':
      return 'laptops';
    default:
      return normalized;
  }
}
