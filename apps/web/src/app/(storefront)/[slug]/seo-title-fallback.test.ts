import { describe, expect, it } from 'vitest';
import { getStorefrontSeoTitle } from './seo-helpers';

describe('storefront SEO title fallback', () => {
  it.each([
    'Buy Gadgets Pay Later',
    'Premium Hair Extensions',
    'Fresh Food',
  ])('preserves a merchant-authored title containing %s', (claim) => {
    expect(
      getStorefrontSeoTitle({
        business_name: 'Medplus',
        business_type: 'pharmaceuticals',
        site_title: `Medplus | ${claim}`,
        site_description: null,
        site_tagline: null,
        country: null,
      } as never)
    ).toBe(`Medplus | ${claim}`);
  });

  it('uses neutral copy only when no authored title exists', () => {
    expect(
      getStorefrontSeoTitle({
        business_name: 'Foodflow',
        business_type: 'food-beverage',
        site_title: ' ',
        site_description: null,
        site_tagline: null,
        country: null,
      } as never)
    ).toBe('Foodflow | Storefront');
  });
});
