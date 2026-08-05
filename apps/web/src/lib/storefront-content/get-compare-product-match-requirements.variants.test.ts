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

  it('merges aligned slug variants into display-name requirements', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productNames: ['Apple iPhone 15', 'Apple iPhone 16'],
      productSlugs: ['apple-iphone-15-256gb', 'apple-iphone-16-128gb'],
    });

    expect(requirements).toEqual([
      {
        identifier: '15',
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

  it('retains explicit color discriminators for same-model siblings', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productNames: ['Apple iPhone 15 Black', 'Apple iPhone 15 Blue'],
    });

    expect(requirements).toEqual([
      { identifier: '15', brand: 'apple', discriminatorTokens: ['black'] },
      { identifier: '15', brand: 'apple', discriminatorTokens: ['blue'] },
    ]);
  });

  it('keeps proven numeric laptop families in compare identifiers', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'laptops',
      brands: ['Dell'],
      productNames: ['Dell XPS 13 9340', 'Dell XPS 14 9340'],
    });

    expect(requirements).toEqual([
      { identifier: 'xps 13 9340', brand: 'dell' },
      { identifier: 'xps 14 9340', brand: 'dell' },
    ]);
  });
});
