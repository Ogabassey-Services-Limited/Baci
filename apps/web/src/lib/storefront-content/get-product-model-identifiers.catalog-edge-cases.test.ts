import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers catalog edge cases', () => {
  it('removes a terminal quote-only display size from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['MSI'],
      productSlugs: ['msi-modern-15-b13m-laptop-15-6'],
    });

    expect(identifiers).toEqual(['modern 15 b13m']);
  });

  it('orders ThinkPad generation tokens for guide matching', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Lenovo'],
      productSlugs: ['lenovo-thinkpad-gen-8-x1-14-inch'],
    });

    expect(identifiers).toEqual(['thinkpad x1 gen 8']);
  });

  it('retains Galaxy Buds family context in earbud identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'earbuds',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-buds-pro', 'samsung-galaxy-buds-live'],
    });

    expect(identifiers).toEqual(['galaxy buds pro', 'galaxy buds live']);
  });
});
