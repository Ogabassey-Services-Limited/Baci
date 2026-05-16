import { describe, expect, it } from 'vitest';
import {
  buildTransactionReviewRangeFilters,
  buildTransactionDateIso,
  filterTransactionOrders,
  formatTransactionDateInput,
  getSupplierNameFromMetadata,
  mapTransactionOrderRows,
} from './transaction-review';

describe('transaction review helpers', () => {
  it('maps paid order rows with supplier, IMEI, serial, and profit metadata', () => {
    const [order] = mapTransactionOrderRows([
      {
        created_at: '2026-05-11T12:30:00.000Z',
        transaction_date: '2026-05-10T12:30:00.000Z',
        customer_email: 'newton@example.com',
        customer_name: 'Newton Chiemelie',
        customer_phone: '08030000000',
        fulfillment_details: { serialNumber: 'ORDER-SN-1' },
        id: 'order-1',
        order_items: [
          {
            fulfillment_data: { imei: '353232106161443' },
            id: 'item-1',
            name: 'iPhone 11 Pro',
            price: 180_000,
            product_id: 'product-1',
            products: {
              cost_price: 120_000,
              fulfillment_details: { items: [] },
              metadata: { supplier_name: 'Slot Wholesale' },
              sku: 'IP11-PRO',
            },
            quantity: 1,
          },
        ],
        order_number: 'ORD-110526-74B115',
        payment_method: 'transfer',
        total: 180_000,
      },
    ]);

    expect(order).toMatchObject({
      createdAt: '2026-05-10T12:30:00.000Z',
      customerEmail: 'newton@example.com',
      customerName: 'Newton Chiemelie',
      customerPhone: '08030000000',
      estimatedProfit: 60_000,
      missingCostCount: 0,
      orderNumber: 'ORD-110526-74B115',
    });
    expect(order.items[0]).toMatchObject({
      costPrice: 120_000,
      imeiValues: ['353232106161443'],
      serialValues: ['ORDER-SN-1'],
      sku: 'IP11-PRO',
      supplierName: 'Slot Wholesale',
    });
    expect(order.searchText).toContain('newton chiemelie');
    expect(order.searchText).toContain('353232106161443');
    expect(order.searchText).toContain('slot wholesale');
  });

  it('filters transactions by order, customer, supplier, IMEI, or serial text', () => {
    const orders = mapTransactionOrderRows([
      {
        created_at: '2026-05-11T12:30:00.000Z',
        transaction_date: null,
        customer_email: null,
        customer_name: 'Newton Chiemelie',
        customer_phone: null,
        fulfillment_details: null,
        id: 'order-1',
        order_items: [
          {
            fulfillment_data: { imei: '353232106161443' },
            id: 'item-1',
            name: 'iPhone 11 Pro',
            price: 180_000,
            product_id: 'product-1',
            products: {
              cost_price: null,
              fulfillment_details: null,
              metadata: { vendor_name: 'Ogabassey Supplier' },
              sku: 'IP11-PRO',
            },
            quantity: 1,
          },
        ],
        order_number: 'ORD-110526-74B115',
        payment_method: 'transfer',
        total: 180_000,
      },
      {
        created_at: '2026-05-09T12:30:00.000Z',
        transaction_date: null,
        customer_email: null,
        customer_name: 'Efosa Igbinovia',
        customer_phone: null,
        fulfillment_details: { serial_number: 'SN-EFOSA-9' },
        id: 'order-2',
        order_items: [],
        order_number: 'ORD-260509-00NV-R',
        payment_method: 'bank_transfer',
        total: 835_000,
      },
    ]);

    expect(filterTransactionOrders(orders, '353232106161443')).toHaveLength(1);
    expect(filterTransactionOrders(orders, 'ogabassey supplier')).toHaveLength(
      1
    );
    expect(filterTransactionOrders(orders, 'SN-EFOSA-9')[0]?.orderNumber).toBe(
      'ORD-260509-00NV-R'
    );
    expect(filterTransactionOrders(orders, 'missing text')).toEqual([]);
  });

  it('builds range filters that fall back to created_at for historical rows', () => {
    expect(buildTransactionReviewRangeFilters(undefined, undefined)).toEqual({
      endDateFilter: undefined,
      startDateFilter: undefined,
    });
    expect(
      buildTransactionReviewRangeFilters('2026-05-01T00:00:00.000Z', undefined)
    ).toEqual({
      endDateFilter: undefined,
      startDateFilter:
        'transaction_date.gte.2026-05-01T00:00:00.000Z,and(transaction_date.is.null,created_at.gte.2026-05-01T00:00:00.000Z)',
    });
    expect(
      buildTransactionReviewRangeFilters(undefined, '2026-05-31T23:59:59.999Z')
    ).toEqual({
      endDateFilter:
        'transaction_date.lte.2026-05-31T23:59:59.999Z,and(transaction_date.is.null,created_at.lte.2026-05-31T23:59:59.999Z)',
      startDateFilter: undefined,
    });
    expect(
      buildTransactionReviewRangeFilters(
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T23:59:59.999Z'
      )
    ).toEqual({
      endDateFilter:
        'transaction_date.lte.2026-05-31T23:59:59.999Z,and(transaction_date.is.null,created_at.lte.2026-05-31T23:59:59.999Z)',
      startDateFilter:
        'transaction_date.gte.2026-05-01T00:00:00.000Z,and(transaction_date.is.null,created_at.gte.2026-05-01T00:00:00.000Z)',
    });
  });

  it('normalizes supplier and date edits', () => {
    expect(
      getSupplierNameFromMetadata({ supplier: ' Tech Distributors ' })
    ).toBe('Tech Distributors');
    expect(getSupplierNameFromMetadata(null)).toBe('');
    expect(getSupplierNameFromMetadata(undefined)).toBe('');
    expect(getSupplierNameFromMetadata({ color: 'black' })).toBe('');
    expect(formatTransactionDateInput('2026-05-11T12:30:00.000Z')).toBe(
      '2026-05-11'
    );
    expect(formatTransactionDateInput('not-a-date')).toBe('');
    expect(buildTransactionDateIso('2026-05-12')).toBe(
      '2026-05-12T00:00:00.000Z'
    );
    expect(buildTransactionDateIso('05-12-2026')).toBeNull();
    expect(buildTransactionDateIso('2026-02-31')).toBeNull();
  });

  it('maps edge cases for nullable items, product arrays, and fallback labels', () => {
    const [emptyOrder, mixedOrder] = mapTransactionOrderRows([
      {
        created_at: '2026-05-11T12:30:00.000Z',
        transaction_date: null,
        customer_email: null,
        customer_name: null,
        customer_phone: null,
        fulfillment_details: null,
        id: 'order-with-long-id',
        order_items: null,
        order_number: null,
        payment_method: null,
        total: null,
      },
      {
        created_at: '2026-05-12T12:30:00.000Z',
        transaction_date: '2026-05-13T12:30:00.000Z',
        customer_email: null,
        customer_name: 'Mixed Customer',
        customer_phone: null,
        fulfillment_details: null,
        id: 'order-2',
        order_items: [
          {
            fulfillment_data: null,
            id: 'item-1',
            name: 'Known Cost',
            price: 5000,
            product_id: 'product-1',
            products: [
              {
                cost_price: 2500,
                fulfillment_details: null,
                metadata: null,
                sku: 'KNOWN',
              },
            ],
            quantity: 2,
          },
          {
            fulfillment_data: null,
            id: 'item-2',
            name: 'Missing Cost',
            price: 4000,
            product_id: 'product-2',
            products: {
              cost_price: null,
              fulfillment_details: null,
              metadata: null,
              sku: null,
            },
            quantity: 1,
          },
        ],
        order_number: 'ORD-MIXED',
        payment_method: 'transfer',
        total: 14_000,
      },
    ]);

    expect(emptyOrder).toMatchObject({
      createdAt: '2026-05-11T12:30:00.000Z',
      customerName: 'Customer',
      items: [],
      missingCostCount: 0,
      orderNumber: 'order-wi',
      paymentMethod: 'unknown',
      total: 0,
    });
    expect(mixedOrder).toMatchObject({
      createdAt: '2026-05-13T12:30:00.000Z',
      estimatedProfit: 5000,
      missingCostCount: 1,
      orderNumber: 'ORD-MIXED',
    });
  });
});
