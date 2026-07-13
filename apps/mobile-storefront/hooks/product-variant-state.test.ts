import { describe, expect, it } from '@jest/globals';
import { isVariantBearingProduct } from './product-variant-state';

describe('isVariantBearingProduct', () => {
  it('recognizes explicit and sku_matrix variant products', () => {
    expect(isVariantBearingProduct({ has_variants: true })).toBe(true);
    expect(
      isVariantBearingProduct({
        has_variants: false,
        variant_model: 'sku_matrix',
      })
    ).toBe(true);
    expect(
      isVariantBearingProduct({
        has_variants: null,
        variant_model: 'sku_matrix',
      })
    ).toBe(true);
  });

  it('does not classify simple legacy products as variant-bearing', () => {
    expect(
      isVariantBearingProduct({
        has_variants: false,
        variant_model: 'legacy',
      })
    ).toBe(false);
    expect(isVariantBearingProduct({})).toBe(false);
  });
});
