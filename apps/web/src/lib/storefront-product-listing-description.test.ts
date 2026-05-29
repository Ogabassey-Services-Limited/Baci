import { describe, expect, it } from 'vitest';
import { buildStorefrontProductListingDescription } from './storefront-product-listing-description';

describe('buildStorefrontProductListingDescription', () => {
  it('preserves an explicit product description when present', () => {
    expect(
      buildStorefrontProductListingDescription({
        brand: 'Dell',
        category: 'Gaming Laptops',
        description: 'Desktop-class gaming power.',
        name: 'Alienware 18',
      })
    ).toBe('Desktop-class gaming power.');
  });

  it('builds compact listing copy from selected fields when description is omitted', () => {
    expect(
      buildStorefrontProductListingDescription({
        brand: 'Dell',
        category: 'Gaming Laptops',
        description: null,
        name: 'Alienware 18',
      })
    ).toBe('Dell Gaming Laptops');
  });

  it('falls back to product name when only identity fields are available', () => {
    expect(
      buildStorefrontProductListingDescription({
        description: '',
        name: 'Alienware 18',
      })
    ).toBe('Alienware 18');
  });
});
