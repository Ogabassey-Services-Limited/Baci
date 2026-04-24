import { describe, expect, it } from 'vitest';
import {
  getEffectiveProductStock,
  getProductLowStockThreshold,
  getProductStockBucket,
  normalizeProductInventory,
  toNonNegativeInteger,
} from './product-inventory';

describe('product inventory helpers', () => {
  it('coerces numeric values into non-negative integers', () => {
    expect(toNonNegativeInteger('12.9')).toBe(12);
    expect(toNonNegativeInteger(-3)).toBe(0);
    expect(toNonNegativeInteger(Number.NaN)).toBe(0);
  });

  it('prefers legacy stock when stock_quantity drifted to zero', () => {
    expect(getEffectiveProductStock({ stock: 9, stock_quantity: 0 })).toBe(9);
  });

  it('falls back to the default low-stock threshold when none is configured', () => {
    expect(getProductLowStockThreshold({ low_stock_threshold: null })).toBe(5);
  });

  it('classifies stock buckets consistently', () => {
    expect(
      getProductStockBucket({
        manage_stock: false,
        stock_quantity: 0,
      })
    ).toBe('unmanaged');
    expect(
      getProductStockBucket({
        manage_stock: null,
        stock_quantity: 0,
      })
    ).toBe('unmanaged');
    expect(
      getProductStockBucket({
        manage_stock: true,
        stock_quantity: 2,
        low_stock_threshold: 3,
      })
    ).toBe('low_stock');
  });

  it('treats missing manage_stock as unmanaged so callers must populate the field', () => {
    // Regression guard: partial rows that omit manage_stock should not be
    // interpreted as managed-with-zero-stock. Callers (e.g. cached SEO
    // selectors) are required to include manage_stock before bucketing so
    // structured data reflects the merchant's real inventory mode.
    expect(
      getProductStockBucket({
        stock: 0,
        stock_quantity: 0,
      })
    ).toBe('unmanaged');
  });

  it('normalizes stock columns to the same effective value', () => {
    expect(
      normalizeProductInventory({
        stock: 7,
        stock_quantity: 0,
        manage_stock: true,
      })
    ).toMatchObject({
      stock: 7,
      stock_quantity: 7,
      manage_stock: true,
    });
  });
});
