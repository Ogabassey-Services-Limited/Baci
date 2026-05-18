import { describe, expect, it } from 'vitest';
import { buildOrderReportSummary } from './buildOrderReportSummary';
import { makeOrder, makeOrderItemQueryData } from './order-export.test-helpers';

describe('buildOrderReportSummary', () => {
  it('aggregates totals, statuses, breakdowns, and top product insights', () => {
    const orders = [
      makeOrder({
        id: 'order_1',
        order_number: 'BAC-001',
        payment_method: 'bank_transfer',
        shipping_status: 'delivered',
        source: 'storefront',
        subtotal: 9500,
        total: 11500,
      }),
      makeOrder({
        discount_amount: 1000,
        id: 'order_2',
        order_number: 'BAC-002',
        payment_method: 'cash',
        shipping_fee: 1000,
        shipping_status: 'processing',
        source: 'whatsapp',
        subtotal: 5000,
        tax_amount: 500,
        total: 5500,
      }),
    ];
    const itemData = [
      makeOrderItemQueryData({
        price: 2500,
        products: { name: 'Laptop Bag' },
        quantity: 2,
      }),
      makeOrderItemQueryData({
        price: 3000,
        product_id: 'product_2',
        products: { name: 'Laptop Bag' },
        quantity: 1,
      }),
      makeOrderItemQueryData({
        price: 500,
        product_id: 'product_3',
        products: { name: 'Sticker Pack' },
        quantity: 4,
      }),
    ];

    const summary = buildOrderReportSummary(orders, itemData);

    expect(summary.totalOrders).toBe(2);
    expect(summary.totalRevenue).toBe(17000);
    expect(summary.totalSubtotal).toBe(14500);
    expect(summary.totalShipping).toBe(2500);
    expect(summary.totalTax).toBe(1500);
    expect(summary.totalDiscounts).toBe(1500);
    expect(summary.pendingCount).toBe(0);
    expect(summary.processingCount).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.totalUnitsSold).toBe(7);
    expect(summary.topProduct).toEqual({
      name: 'Sticker Pack',
      qty: 4,
      revenue: 2000,
    });
    expect(summary.salesByOrigin).toEqual([
      ['storefront', { count: 1, total: 11500 }],
      ['whatsapp', { count: 1, total: 5500 }],
    ]);
    expect(summary.salesByPaymentMethod).toEqual([
      ['bank_transfer', { count: 1, total: 11500 }],
      ['cash', { count: 1, total: 5500 }],
    ]);
  });

  it('falls back safely when there are no orders or item details', () => {
    const summary = buildOrderReportSummary([], []);

    expect(summary.totalOrders).toBe(0);
    expect(summary.totalRevenue).toBe(0);
    expect(summary.totalUnitsSold).toBe(0);
    expect(summary.topProduct).toBeNull();
    expect(summary.salesByOrigin).toEqual([]);
    expect(summary.salesByPaymentMethod).toEqual([]);
  });
});
