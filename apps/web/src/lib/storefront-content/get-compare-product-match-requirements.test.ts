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
});
