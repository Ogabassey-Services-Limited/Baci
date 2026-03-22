import { describe, expect, it } from 'vitest';
import { buildBumpaOrderPreview } from '@/lib/imports/bumpa/build-bumpa-order-preview';

const baseRow = {
  id: '4196546',
  'Order Number': '06397',
  Products: 'Samsung A17 8gb 256gb (New) | Pouch And Screen Guard | Delivery',
  'Customer Name': 'Queen Banigo',
  'Customer Email': 'queenbanigo3@gmail.com',
  'Customer Phone': '',
  'Payment Status': 'PAID',
  Status: 'COMPLETED',
  'Shipping Status': 'UNFULFILLED',
  Channel: 'MOBILE',
  Origin: 'instagram',
  Total: '350250.00',
  'Sub Total': '350250.00',
  Discount: '0.00',
  'Amount Paid': '350250.00',
  'Amount Due': '0.00',
  'Order Date': '2026-03-19 15:00:43',
  'Created At': '2026-03-19',
  'Updated At': '2026-03-19',
  'Shipping Price': '0.00',
  Tax: '0.00',
  'Coupon Code': '',
  'Shipping Option': '',
  'Product SKU': ' |  | ',
  'Product Quantity': '1.00 | 1.00 | 1.00',
};

describe('buildBumpaOrderPreview', () => {
  it('builds normalized rows and infers receipt readiness', () => {
    const result = buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [],
      existingProducts: [
        {
          id: 'product-phone',
          name: 'Samsung A17 8gb 256gb (New)',
          sku: null,
          price: 333250,
          externalSource: null,
          externalId: null,
        },
        {
          id: 'product-pouch',
          name: 'Pouch And Screen Guard',
          sku: null,
          price: 9000,
          externalSource: null,
          externalId: null,
        },
        {
          id: 'product-delivery',
          name: 'Delivery',
          sku: null,
          price: 8000,
          externalSource: null,
          externalId: null,
        },
      ],
    });

    expect(result.summary.totalRows).toBe(1);
    expect(result.summary.validRows).toBe(1);
    expect(result.summary.receiptReadyOrders).toBe(1);
    expect(result.rows[0]?.payload?.shippingStatus).toBe('delivered');
    expect(result.rows[0]?.payload?.items).toHaveLength(3);
    expect(result.rows[0]?.payload?.items[0]).toMatchObject({
      matched: true,
      productId: 'product-phone',
    });
  });

  it('marks duplicate external ids in the same file', () => {
    const result = buildBumpaOrderPreview({
      rows: [baseRow, { ...baseRow }],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[1]?.rowStatus).toBe('duplicate');
    expect(result.summary.duplicateCount).toBe(1);
  });

  it('marks conflicting order numbers as invalid', () => {
    const result = buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [
        {
          id: 'existing-order',
          orderNumber: '06397',
          externalSource: null,
          externalId: null,
        },
      ],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.rows[0]?.errors?.[0]).toContain('already exists');
  });

  it('classifies phone-only customers in the preview summary', () => {
    const result = buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: 'order-2',
          'Customer Email': '',
          'Customer Phone': '08122221631',
          'Payment Status': 'PARTIALLY_PAID',
          Status: 'OPEN',
          'Shipping Status': '',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.summary.phoneOnlyCustomers).toBe(1);
    expect(result.rows[0]?.payload?.receiptReady).toBe(false);
  });
});
