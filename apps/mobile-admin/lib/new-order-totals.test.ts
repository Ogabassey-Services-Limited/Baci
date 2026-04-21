import { describe, expect, it } from 'vitest';
import type { OrderItem } from '@/components/orders/new-order.types';
import { createNewOrderTotals } from './new-order-totals';

function createOrderItem(overrides: Partial<OrderItem>): OrderItem {
  return {
    id: 'item-1',
    name: 'Phone',
    price: 0,
    product_id: 'product-1',
    quantity: 1,
    variant_id: null,
    variant_name: null,
    ...overrides,
  };
}

describe('createNewOrderTotals', () => {
  it('calculates VAT-backed totals when VAT is applied', () => {
    const totals = createNewOrderTotals({
      discount: 500,
      isVatApplied: true,
      merchantCurrency: 'NGN',
      merchantVatRate: 10,
      orderItems: [
        createOrderItem({ price: 10000, quantity: 2 }),
        createOrderItem({ id: 'item-2', name: 'Case', price: 5000 }),
      ],
      shippingFee: 1500,
      taxes: 0,
    });

    expect(totals.subtotal).toBe(25000);
    expect(totals.calculatedVat).toBe(2450);
    expect(totals.taxesToUse).toBe(2450);
    expect(totals.total).toBe(28450);
    expect(totals.formatPrice(1000)).toContain('₦');
  });

  it('clamps VAT to zero when discount exceeds subtotal', () => {
    const totals = createNewOrderTotals({
      discount: 9999,
      isVatApplied: true,
      merchantCurrency: 'NGN',
      merchantVatRate: 10,
      orderItems: [createOrderItem({ price: 5000, quantity: 1 })],
      shippingFee: 0,
      taxes: 0,
    });

    expect(totals.calculatedVat).toBe(0);
    expect(totals.taxesToUse).toBe(0);
  });

  it('preserves an explicit zero VAT rate instead of defaulting to 7.5%', () => {
    const totals = createNewOrderTotals({
      discount: 0,
      isVatApplied: true,
      merchantCurrency: 'NGN',
      merchantVatRate: 0,
      orderItems: [createOrderItem({ name: 'Bag', price: 2000, quantity: 2 })],
      shippingFee: 500,
      taxes: 300,
    });

    expect(totals.calculatedVat).toBe(0);
    expect(totals.taxesToUse).toBe(0);
    expect(totals.total).toBe(4500);
  });
});
