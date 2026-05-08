import { describe, expect, it } from 'vitest';
import { getReceiptFulfillmentRows } from './receipt-fulfillment';
import type { ReceiptOrder } from './types';

function createReceiptOrder(
  overrides: Partial<ReceiptOrder> = {}
): ReceiptOrder {
  return {
    order_number: 'ORD-123',
    created_at: '2026-04-08T18:02:55.974Z',
    currency: 'NGN',
    total: 500000,
    subtotal: 500000,
    shipping_fee: 0,
    tax_amount: 0,
    discount_amount: 0,
    amount_paid: 500000,
    balance: 0,
    payment_status: 'paid',
    payment_method: 'card',
    customer_name: 'Akinola Ogunniran',
    customer_email: 'akin@example.com',
    customer_phone: null,
    items: [
      {
        product_name: 'Samsung Galaxy S22 Ultra',
        quantity: 1,
        price: 500000,
      },
    ],
    ...overrides,
  };
}

describe('getReceiptFulfillmentRows', () => {
  it('filters blank fulfillment identifiers', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          imei: ' ',
          serialNumber: '',
          serial_number: null,
        },
      })
    );

    expect(rows).toEqual([]);
  });

  it('falls back to legacy serial_number when serialNumber is blank', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          serialNumber: ' ',
          serial_number: 'SN-LEGACY-123',
        },
      })
    );

    expect(rows).toEqual([{ label: 'S/N', value: 'SN-LEGACY-123' }]);
  });

  it('includes non-blank IMEI values', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          imei: 'IMEI-1234567890',
        },
      })
    );

    expect(rows).toEqual([{ label: 'IMEI', value: 'IMEI-1234567890' }]);
  });
});
