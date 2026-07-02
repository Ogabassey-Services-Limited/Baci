import { describe, expect, it } from 'vitest';
import { getMcpProductStockSummary } from './product-stock-summary';

describe('getMcpProductStockSummary', () => {
  it('treats unmanaged stock as available even when quantity is zero', () => {
    expect(
      getMcpProductStockSummary({
        manage_stock: false,
        stock_quantity: 0,
      })
    ).toEqual({
      confidence: 'high',
      inStock: true,
      level: 'Available',
    });
  });

  it('uses quantity bands for managed stock', () => {
    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 11,
      })
    ).toEqual({
      confidence: 'high',
      inStock: true,
      level: 'High Stock',
    });

    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 10,
      })
    ).toEqual({
      confidence: 'low',
      inStock: true,
      level: 'Low Stock',
    });

    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 6,
      })
    ).toEqual({
      confidence: 'low',
      inStock: true,
      level: 'Low Stock',
    });

    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 5,
      })
    ).toEqual({
      confidence: 'low',
      inStock: true,
      level: 'Last Units',
    });

    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 1,
      })
    ).toEqual({
      confidence: 'low',
      inStock: true,
      level: 'Last Units',
    });
  });

  it('marks managed zero stock as out of stock', () => {
    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: 0,
      })
    ).toEqual({
      confidence: 'none',
      inStock: false,
      level: 'Out of Stock',
    });
  });

  it('keeps nullish stock inputs on the documented default paths', () => {
    expect(
      getMcpProductStockSummary({
        manage_stock: null,
        stock_quantity: null,
      })
    ).toEqual({
      confidence: 'high',
      inStock: true,
      level: 'Available',
    });

    expect(
      getMcpProductStockSummary({
        manage_stock: true,
        stock_quantity: null,
      })
    ).toEqual({
      confidence: 'none',
      inStock: false,
      level: 'Out of Stock',
    });
  });
});
