import { describe, expect, it } from 'vitest';
import { mapTransactionOrderRows } from './transaction-review';

describe('transaction review discount total fallback', () => {
  it('uses persisted allocations when the discount total column is unavailable', () => {
    const [order] = mapTransactionOrderRows([
      {
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
        created_at: '2026-08-28T00:00:00.000Z',
        customer_email: null,
        customer_name: 'Missing Discount Total Customer',
        customer_phone: null,
        fulfillment_details: null,
        id: 'order-missing-discount-total',
        order_items: [
          {
            condition: 'new',
            cost_price: 50,
            fulfillment_data: null,
            id: 'item-missing-discount-total',
            line_id: 1,
            name: 'Discounted Product',
            price: 100,
            product_id: 'product-1',
            products: null,
            quantity: 1,
            variant_attributes: {},
            variant_id: null,
          },
        ],
        order_number: 'ORD-MISSING-DISCOUNT-TOTAL',
        payment_method: 'card',
        source: 'online_store',
        total: 80,
      },
    ]);

    expect(order).toMatchObject({
      discountAmount: 20,
      estimatedProfit: 30,
    });
    expect(order.items[0]).toMatchObject({
      profit: 30,
      revenue: 80,
    });
  });
});
