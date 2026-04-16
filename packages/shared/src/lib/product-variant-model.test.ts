import { describe, expect, it } from 'vitest';
import {
  getSkuMatrixValidationError,
  inferProductVariantModel,
  normalizeProductVariantModel,
} from './product-variant-model';

describe('product-variant-model', () => {
  it('normalizes unknown values to legacy', () => {
    expect(normalizeProductVariantModel(undefined)).toBe('legacy');
    expect(normalizeProductVariantModel('legacy')).toBe('legacy');
    expect(normalizeProductVariantModel('sku_matrix')).toBe('sku_matrix');
    expect(normalizeProductVariantModel('unexpected')).toBe('legacy');
  });

  it('infers sku_matrix when at least one variant row has condition', () => {
    expect(
      inferProductVariantModel({
        variants: [
          { condition: 'used', price_override: 600000 },
          { condition: 'new', price_override: 800000 },
        ],
      })
    ).toBe('sku_matrix');
  });

  it('infers legacy when variants are empty or omit condition', () => {
    expect(inferProductVariantModel({ variants: [] })).toBe('legacy');
    expect(
      inferProductVariantModel({
        variants: [
          { price_override: 600000 },
          { condition: '   ', price_override: 800000 },
        ],
      })
    ).toBe('legacy');
  });

  it('infers sku_matrix from mixed rows when any variant has condition', () => {
    expect(
      inferProductVariantModel({
        variants: [
          { price_override: 600000 },
          { condition: 'used', price_override: 550000 },
        ],
      })
    ).toBe('sku_matrix');
  });

  it('does not let an explicit legacy model override conditioned variants', () => {
    expect(
      inferProductVariantModel({
        variantModel: 'legacy',
        variants: [{ condition: 'used', price_override: 600000 }],
      })
    ).toBe('sku_matrix');
  });

  it('returns null for legacy products without variants', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'legacy',
        hasVariants: false,
        variants: [],
      })
    ).toBeNull();
  });

  it('returns null for a valid sku_matrix product', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used', price_override: 550000 }],
      })
    ).toBeNull();
  });

  it('requires variants to be enabled for sku_matrix products', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: false,
        variants: [],
      })
    ).toBe('sku_matrix products must enable variants.');
  });

  it('requires every sku_matrix variant to include a condition', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ price_override: 550000 }],
      })
    ).toBe('Every sku_matrix variant must include a condition.');
  });

  it('requires every sku_matrix variant to include a non-negative price_override when missing', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used' }],
      })
    ).toBe(
      'Every sku_matrix variant must include a non-negative price_override.'
    );

    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used', price_override: Number.NaN }],
      })
    ).toBe(
      'Every sku_matrix variant must include a non-negative price_override.'
    );
  });

  it('requires every sku_matrix variant to include a non-negative price_override when negative', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used', price_override: -1 }],
      })
    ).toBe(
      'Every sku_matrix variant must include a non-negative price_override.'
    );
  });
});
