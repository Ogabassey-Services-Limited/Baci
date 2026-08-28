import { describe, expect, it } from 'vitest';
import { mapTransactionOrderRows } from './transaction-review';

describe('transaction review discount VAT fallback', () => {
  it('preserves VAT relief when a compatibility fallback cannot match v3 line keys', () => {
    const row = {
      ad_tracking: {
        baci_transaction_discount: {
          lineDiscounts: [
            {
              lineId: 1,
              lineKey: '["product-1",null,"new",{}]',
              merchandiseDiscount: 2,
              productId: 'product-1',
              vatRelief: 0.15,
              variantId: null,
            },
          ],
          version: 3,
        },
      },
      created_at: '2026-08-27T12:30:00.000Z',
      customer_email: null,
      customer_name: 'VAT Compatibility Customer',
      customer_phone: null,
      discount_amount: 2.15,
      fulfillment_details: null,
      id: 'order-vat-compatibility',
      order_items: [
        {
          cost_price: 50,
          fulfillment_data: null,
          id: 'item-vat-compatibility',
          line_id: 1,
          name: 'VAT Compatibility Product',
          price: 100,
          product_id: 'product-1',
          products: null,
          quantity: 1,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
      order_number: 'ORD-VAT-COMPATIBILITY',
      payment_method: 'card',
      source: 'physical',
      total: 97.85,
    };

    const [order] = mapTransactionOrderRows([row]);

    expect(order.items[0]).toMatchObject({
      profit: 48,
      revenue: 98,
    });
  });
});
