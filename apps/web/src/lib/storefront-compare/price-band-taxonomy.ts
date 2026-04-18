import type { PriceBandDefinition } from './compare-types';

export const CURATED_PRICE_BANDS = {
  smartphones: [
    {
      slug: 'under-500k',
      label: 'Best Smartphones Under ₦500,000',
      ceiling: 500_000,
    },
    {
      slug: 'under-1m',
      label: 'Best Smartphones Under ₦1,000,000',
      ceiling: 1_000_000,
    },
  ],
  laptops: [
    {
      slug: 'under-1m',
      label: 'Best Laptops Under ₦1,000,000',
      ceiling: 1_000_000,
    },
  ],
  'smart-tvs': [
    {
      slug: 'under-2m',
      label: 'Best Smart TVs Under ₦2,000,000',
      ceiling: 2_000_000,
    },
  ],
} satisfies Record<string, PriceBandDefinition[]>;

export type CuratedPriceBandCategorySlug = keyof typeof CURATED_PRICE_BANDS;

export function getCuratedPriceBands(
  categorySlug: string
): PriceBandDefinition[] {
  return (
    CURATED_PRICE_BANDS[categorySlug as CuratedPriceBandCategorySlug] ?? []
  );
}
