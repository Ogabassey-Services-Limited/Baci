import { describe, expect, it } from 'vitest';
import { mapTransactionOrderRows } from './transaction-review';

describe('transaction review discount mapping', () => {
  it('keeps VAT relief out of merchandise profit for auto-negotiated orders', () => {
    const row = {
      created_at: '2026-07-01T12:30:00.000Z',
      customer_email: null,
      customer_name: 'Negotiated Customer',
      customer_phone: null,
      ad_tracking: {
        baci_transaction_discount: {
          lineDiscounts: [
            { lineId: 1, merchandiseDiscount: 2, vatRelief: 0.15 },
          ],
          version: 2,
        },
      },
      discount_amount: 2.15,
      discount_code_id: null,
      fulfillment_details: null,
      id: 'order-negotiated',
      order_items: [
        {
          cost_price: 50,
          fulfillment_data: null,
          id: 'item-negotiated',
          line_id: 1,
          name: 'Negotiated Product',
          price: 100,
          product_id: 'product-negotiated',
          products: null,
          quantity: 1,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
      order_number: 'ORD-NEGOTIATED',
      payment_method: 'card',
      source: 'online_store',
      total: 100,
    };

    const [order] = mapTransactionOrderRows([row]);

    expect(order.items[0]).toMatchObject({
      profit: 48,
      revenue: 98,
    });
  });

  it('keeps VAT relief out of merchandise profit for pre-metadata negotiated orders', () => {
    const row = {
      created_at: '2026-07-01T12:30:00.000Z',
      customer_email: null,
      customer_name: 'Legacy Negotiated Customer',
      customer_phone: null,
      discount_amount: 2.15,
      discount_code_id: null,
      fulfillment_details: null,
      id: 'order-legacy-negotiated',
      order_items: [
        {
          cost_price: 50,
          fulfillment_data: null,
          id: 'item-legacy-negotiated',
          name: 'Legacy Negotiated Product',
          price: 100,
          product_id: 'product-legacy-negotiated',
          products: null,
          quantity: 1,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
      order_number: 'ORD-LEGACY-NEGOTIATED',
      payment_method: 'card',
      source: 'online_store',
      total: 100,
    };

    const [order] = mapTransactionOrderRows([row]);

    expect(order.items[0]).toMatchObject({
      profit: 48,
      revenue: 98,
    });
  });

  it('does not gross up a manual discount on a physical order', () => {
    const row = {
      created_at: '2026-07-01T12:30:00.000Z',
      customer_email: null,
      customer_name: 'Manual Discount Customer',
      customer_phone: null,
      discount_amount: 2.15,
      discount_code_id: null,
      fulfillment_details: null,
      id: 'order-manual-discount',
      order_items: [
        {
          cost_price: 50,
          fulfillment_data: null,
          id: 'item-manual-discount',
          name: 'Manual Discount Product',
          price: 100,
          product_id: 'product-manual-discount',
          products: null,
          quantity: 1,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
      order_number: 'ORD-MANUAL-DISCOUNT',
      payment_method: 'card',
      source: 'physical',
      total: 100,
    };

    const [order] = mapTransactionOrderRows([row]);

    expect(order.items[0]?.revenue).toBeCloseTo(97.85, 2);
    expect(order.items[0]?.profit).toBeCloseTo(47.85, 2);
  });

  it('uses proportional allocation when a no-variant fallback cannot match v3 line keys', () => {
    const row = {
      ad_tracking: {
        baci_transaction_discount: {
          lineDiscounts: [
            {
              lineId: 1,
              lineKey: '["product-1",null,"new",{}]',
              merchandiseDiscount: 20,
              productId: 'product-1',
              vatRelief: 0,
              variantId: null,
            },
          ],
          version: 3,
        },
      },
      created_at: '2026-08-27T12:30:00.000Z',
      customer_email: null,
      customer_name: 'No Variant Customer',
      customer_phone: null,
      discount_amount: 20,
      fulfillment_details: null,
      id: 'order-no-variant',
      order_items: [
        {
          fulfillment_data: null,
          id: 'item-no-variant-1',
          line_id: 1,
          name: 'First Product',
          price: 100,
          product_id: 'product-1',
          products: null,
          quantity: 1,
        },
        {
          fulfillment_data: null,
          id: 'item-no-variant-2',
          line_id: 2,
          name: 'Second Product',
          price: 100,
          product_id: 'product-2',
          products: null,
          quantity: 1,
        },
      ],
      order_number: 'ORD-NO-VARIANT',
      payment_method: 'card',
      source: 'physical',
      total: 180,
    };

    const [order] = mapTransactionOrderRows([row]);

    expect(order.items.map((item) => item.revenue)).toEqual([90, 90]);
  });

  it('does not discount imported Jumia item prices that already include voucher reductions', () => {
    const [order] = mapTransactionOrderRows([
      {
        created_at: '2026-07-01T12:30:00.000Z',
        customer_email: null,
        customer_name: 'Jumia Customer',
        customer_phone: null,
        discount_amount: 5000,
        external_source: 'jumia',
        fulfillment_details: null,
        id: 'order-jumia',
        order_items: [
          {
            cost_price: 200000,
            fulfillment_data: null,
            id: 'item-jumia',
            name: 'Jumia Product',
            price: 245000,
            product_id: null,
            products: null,
            quantity: 1,
          },
        ],
        order_number: 'JUMIA-12345',
        payment_method: 'jumia',
        source: 'jumia',
        total: 245000,
      },
    ]);

    expect(order.items[0]).toMatchObject({
      profit: 45000,
      revenue: 245000,
    });
  });

  it('applies discounts to manually created Jumia-channel orders', () => {
    const [order] = mapTransactionOrderRows([
      {
        created_at: '2026-07-01T12:30:00.000Z',
        customer_email: null,
        customer_name: 'Manual Jumia Customer',
        customer_phone: null,
        discount_amount: 10,
        fulfillment_details: null,
        id: 'order-manual-jumia',
        order_items: [
          {
            cost_price: 50,
            fulfillment_data: null,
            id: 'item-manual-jumia',
            name: 'Manual Jumia Product',
            price: 100,
            product_id: 'product-manual-jumia',
            products: null,
            quantity: 1,
          },
        ],
        order_number: 'JUMIA-MANUAL-1',
        payment_method: 'cash',
        source: 'jumia',
        total: 90,
      },
    ]);

    expect(order.items[0]).toMatchObject({
      profit: 40,
      revenue: 90,
    });
  });
});
