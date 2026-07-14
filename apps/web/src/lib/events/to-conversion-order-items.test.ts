import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import { toConversionOrderItems } from './to-conversion-order-items';

describe('toConversionOrderItems', () => {
  it('normalizes valid item money and quantity values', () => {
    expect(
      toConversionOrderItems({
        items: [
          { name: 'Phone', price: '100', product_id: 'sku-1', quantity: 2 },
        ],
        orderId: 'order-1',
      })
    ).toEqual([{ id: 'sku-1', name: 'Phone', price: 100, quantity: 2 }]);
  });

  it('fails closed in strict mode', () => {
    expect(() =>
      toConversionOrderItems({
        failOnInvalidItem: true,
        items: [{ name: '', price: null, quantity: 0 }],
        orderId: 'order-1',
      })
    ).toThrow('Invalid order item for conversion tracking');
  });

  it('does not coerce booleans or arrays into numeric values', () => {
    expect(
      toConversionOrderItems({
        items: [
          {
            name: 'Phone',
            price: true as never,
            product_id: 'sku-1',
            quantity: [1] as never,
          },
        ],
        orderId: 'order-1',
      })
    ).toEqual([]);
  });

  it('does not coerce non-decimal numeric strings', () => {
    expect(
      toConversionOrderItems({
        items: [
          { name: 'Phone', price: '0x64', product_id: 'sku-1', quantity: 1 },
          { name: 'Laptop', price: '100', product_id: 'sku-2', quantity: 1 },
          {
            name: 'Tablet',
            price: '100',
            product_id: 'sku-3',
            quantity: '1e2' as never,
          },
        ],
        orderId: 'order-1',
      })
    ).toEqual([{ id: 'sku-2', name: 'Laptop', price: 100, quantity: 1 }]);
  });
});
