import { describe, expect, it } from 'vitest';
import { getCompareProductMatchRequirements } from './get-compare-product-match-requirements';

describe('getCompareProductMatchRequirements', () => {
  it('keeps brand discriminators when compared models share an identifier', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'smartwatches',
      brands: ['Apple', 'Samsung'],
      productSlugs: ['apple-watch-ultra-49mm', 'samsung-watch-ultra'],
    });

    expect(requirements).toEqual([
      { identifier: 'watch ultra', brand: 'apple' },
      { identifier: 'watch ultra', brand: 'samsung' },
    ]);
  });

  it('retains occurrence discriminators for same-brand model variants', () => {
    const requirements = getCompareProductMatchRequirements({
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productNames: [
        'Apple iPhone 15 6GB 128GB eSIM',
        'Apple iPhone 15 6GB 256GB physical SIM',
      ],
    });

    expect(requirements).toEqual([
      { identifier: '15', brand: null, discriminatorTokens: ['128gb', 'esim'] },
      {
        identifier: '15',
        brand: null,
        discriminatorTokens: ['256gb', 'physical', 'sim'],
      },
    ]);
  });
});
