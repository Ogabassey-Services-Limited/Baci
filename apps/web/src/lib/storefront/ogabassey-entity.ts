export const OGABASSEY_ENTITY = {
  businessType: 'electronics',
  categories: ['phones', 'laptops', 'gaming', 'gadgets', 'accessories'],
  displayName: 'OgaBassey',
  topicalFocus:
    'phones, laptops, gaming devices, accessories, repairs, and flexible gadget payments in Nigeria',
} as const;

export function normalizeOgabasseyBusinessType(input: {
  business_type?: string | null;
  custom_domain?: string | null;
  slug?: string | null;
}): string {
  const isOgabassey =
    input.slug?.toLowerCase() === 'ogabassey' ||
    input.custom_domain?.toLowerCase() === 'ogabassey.com';

  return isOgabassey
    ? OGABASSEY_ENTITY.businessType
    : input.business_type?.trim() || 'general';
}
