import { describe, expect, it } from 'vitest';
import { getCompareProductMatchRequirements } from './get-compare-product-match-requirements';

describe('getCompareProductMatchRequirements variant preservation', () => {
  it('keeps storage discriminators for products with distinct identifiers', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productNames: ['Apple iPhone 15 Pro 256GB', 'Apple iPhone 16 128GB'],
    });

    expect(requirements).toEqual([
      {
        identifier: '15 pro',
        brand: 'apple',
        discriminatorTokens: ['256gb'],
      },
      {
        identifier: '16',
        brand: 'apple',
        discriminatorTokens: ['128gb'],
      },
    ]);
  });

  it('keeps shared and additional tokens for subset connectivity variants', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'tablets',
      brands: ['Apple'],
      productNames: ['Apple iPad 10 Wi-Fi', 'Apple iPad 10 Wi-Fi Cellular'],
    });

    expect(requirements).toEqual([
      {
        identifier: '10',
        brand: 'apple',
        discriminatorTokens: ['wifi'],
      },
      {
        identifier: '10',
        brand: 'apple',
        discriminatorTokens: ['wifi', 'cellular'],
      },
    ]);
  });
});
