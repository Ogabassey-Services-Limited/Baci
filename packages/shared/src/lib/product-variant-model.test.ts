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

  it('prefers the explicit variant_model when provided', () => {
    expect(
      inferProductVariantModel({
        variantModel: 'legacy',
        variants: [{ condition: 'used', price_override: 600000 }],
      })
    ).toBe('legacy');
  });

  it('validates sku_matrix condition and price requirements', () => {
    expect(
      getSkuMatrixValidationError({
        variantModel: 'legacy',
        hasVariants: false,
        variants: [],
      })
    ).toBeNull();

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
    ).toBe('Every sku_matrix variant must include an explicit price_override.');

    expect(
      getSkuMatrixValidationError({
        variantModel: 'sku_matrix',
        hasVariants: true,
        variants: [{ condition: 'used', price_override: Number.NaN }],
      })
    ).toBe('Every sku_matrix variant must include an explicit price_override.');
  });
});
