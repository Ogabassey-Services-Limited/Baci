import { describe, expect, it } from 'vitest';
import {
  getSkuMatrixValidationError,
  inferProductVariantModel,
  normalizeProductVariantModel,
} from '@/lib/product-variant-model';

describe('product variant model helpers', () => {
  it('normalizes unknown values to legacy', () => {
    expect(normalizeProductVariantModel(undefined)).toBe('legacy');
    expect(normalizeProductVariantModel('legacy')).toBe('legacy');
    expect(normalizeProductVariantModel('unexpected')).toBe('legacy');
  });

  it('infers sku_matrix when variant rows carry a condition axis', () => {
    expect(
      inferProductVariantModel({
        variants: [
          { condition: 'used', price_override: 600000 },
          { condition: 'new', price_override: 800000 },
        ],
      })
    ).toBe('sku_matrix');
  });

  it('does not infer sku_matrix when variants are missing or omit condition', () => {
    expect(inferProductVariantModel({})).toBe('legacy');
    expect(inferProductVariantModel({ variants: [] })).toBe('legacy');
    expect(
      inferProductVariantModel({
        variants: [{ price_override: 100 }],
      })
    ).toBe('legacy');
  });

  it('does not let an explicit legacy model override conditioned variants', () => {
    expect(
      inferProductVariantModel({
        variantModel: 'legacy',
        variants: [{ condition: 'used', price_override: 600000 }],
      })
    ).toBe('sku_matrix');
  });

  it('validates required sku_matrix variant fields', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used', price_override: 550000 }],
      })
    ).toBeNull();

    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: false,
        variants: [],
      })
    ).toBe('sku_matrix products must enable variants.');

    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ price_override: 550000 }],
      })
    ).toBe('Every sku_matrix variant must include a condition.');

    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used' }],
      })
    ).toBe(
      'Every sku_matrix variant must include a non-negative price_override.'
    );
  });
});
