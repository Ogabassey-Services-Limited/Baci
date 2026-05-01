import { describe, expect, it } from 'vitest';
import {
  getEffectiveProductStock,
  getProductLowStockThreshold,
  getProductStockBucket,
  normalizeProductInventory,
} from '@/lib/product-inventory';

describe('product inventory helpers', () => {
  it('prefers legacy stock when stock_quantity is zero but legacy stock is positive', () => {
    expect(getEffectiveProductStock({ stock: 12, stock_quantity: 0 })).toBe(12);
  });

  it('prefers stock_quantity when it contains the current positive stock', () => {
    expect(getEffectiveProductStock({ stock: 0, stock_quantity: 7 })).toBe(7);
  });

  it('falls back to the default low-stock threshold when none is configured', () => {
    expect(getProductLowStockThreshold({ low_stock_threshold: null })).toBe(5);
  });

  it('classifies unmanaged products separately from tracked stock', () => {
    expect(
      getProductStockBucket({
        manage_stock: false,
        stock: 0,
        stock_quantity: 0,
      })
    ).toBe('unmanaged');
  });

  it('classifies positive stock below the threshold as low stock', () => {
    expect(
      getProductStockBucket({
        manage_stock: true,
        stock_quantity: 2,
        low_stock_threshold: 3,
      })
    ).toBe('low_stock');
  });

  it('normalizes both stock columns to the same effective value', () => {
    expect(
      normalizeProductInventory({
        stock: 9,
        stock_quantity: 0,
        manage_stock: true,
      })
    ).toMatchObject({
      stock: 9,
      stock_quantity: 9,
      manage_stock: true,
    });
  });
});
