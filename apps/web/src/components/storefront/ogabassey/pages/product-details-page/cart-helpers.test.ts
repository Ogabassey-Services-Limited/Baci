import { describe, expect, it } from 'vitest';
import {
  applySingleOptionAxisSelectionsToVariants,
  getAxisOptions,
  hasVariantBackedAxis,
} from './cart-helpers';
import type { NormalizedProductDetails } from './product-normalization';

function productFixture(
  overrides: Partial<NormalizedProductDetails>
): NormalizedProductDetails {
  return {
    platforms: [],
    storage: [],
    ...overrides,
  } as unknown as NormalizedProductDetails;
}

describe('cart helpers', () => {
  it('reads variant-backed options from legacy-cased attribute keys', () => {
    const product = productFixture({
      variants: [
        {
          attributes: { Storage: '128GB' },
          id: 'variant-128',
          stock_quantity: 2,
        },
        {
          attributes: { Storage: '256GB' },
          id: 'variant-256',
          stock_quantity: 2,
        },
      ],
    });

    expect(getAxisOptions('storage', product)).toEqual(['128GB', '256GB']);
  });

  it('falls back to one metadata option when variant rows lack the axis', () => {
    const product = productFixture({
      storage: ['128GB'],
      variants: [
        {
          attributes: {},
          id: 'variant-128',
          stock_quantity: 2,
        },
      ],
    });

    expect(getAxisOptions('storage', product)).toEqual(['128GB']);
  });

  it('falls back to one generic metadata option when variant rows lack the axis', () => {
    const product = productFixture({
      variant_attributes: { ram: ['8GB'] },
      variants: [
        {
          attributes: {},
          id: 'variant-8gb',
          stock_quantity: 2,
        },
      ],
    });

    expect(getAxisOptions('ram', product)).toEqual(['8GB']);
  });

  it('detects whether an axis is backed by variant rows', () => {
    const product = productFixture({
      variants: [
        {
          attributes: { Storage: '128GB' },
          id: 'variant-128',
          stock_quantity: 2,
        },
      ],
    });

    expect(hasVariantBackedAxis('storage', product.variants)).toBe(true);
    expect(hasVariantBackedAxis('platform', product.variants)).toBe(false);
  });

  it('does not expose multi-option metadata fallbacks without variant-backed values', () => {
    const product = productFixture({
      storage: ['128GB', '256GB'],
      variants: [
        {
          attributes: {},
          id: 'variant-empty',
          stock_quantity: 2,
        },
      ],
    });

    expect(getAxisOptions('storage', product)).toEqual([]);
  });

  it('normalizes missing single-option axes into variant rows for resolution', () => {
    expect(
      applySingleOptionAxisSelectionsToVariants(
        [
          {
            attributes: {},
            id: 'variant-empty',
            stock_quantity: 2,
          },
          {
            attributes: { storage: '256GB' },
            id: 'variant-explicit',
            stock_quantity: 2,
          },
        ],
        { storage: '128GB' }
      )
    ).toEqual([
      {
        attributes: { storage: '128GB' },
        id: 'variant-empty',
        stock_quantity: 2,
      },
      {
        attributes: { storage: '256GB' },
        id: 'variant-explicit',
        stock_quantity: 2,
      },
    ]);
  });
});
