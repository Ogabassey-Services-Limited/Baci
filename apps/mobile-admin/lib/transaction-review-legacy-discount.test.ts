import { describe, expect, it } from 'vitest';
import { isLegacyVatInclusiveNegotiationDiscount } from './transaction-review-legacy-discount';
import type { TransactionReviewOrderRow } from './transaction-review-types';

const baseOrder: TransactionReviewOrderRow = {
  created_at: '2026-07-01T12:30:00.000Z',
  customer_email: null,
  customer_name: 'Legacy Customer',
  customer_phone: null,
  discount_amount: 2.15,
  discount_code_id: null,
  fulfillment_details: null,
  id: 'order-legacy',
  order_items: [
    {
      fulfillment_data: null,
      id: 'item-legacy',
      name: 'Legacy Product',
      price: 100,
      product_id: 'product-legacy',
      products: null,
      quantity: 1,
      vat_category_code: 'S',
      vat_rate: 7.5,
    },
  ],
  order_number: 'ORD-LEGACY',
  payment_method: 'card',
  source: 'online_store',
  total: 100,
};

describe('legacy transaction discount detection', () => {
  it('recognizes a pre-metadata online negotiation with VAT relief', () => {
    expect(
      isLegacyVatInclusiveNegotiationDiscount(
        baseOrder,
        baseOrder.order_items ?? []
      )
    ).toBe(true);
  });

  it('does not classify a physical-order discount as an automatic negotiation', () => {
    expect(
      isLegacyVatInclusiveNegotiationDiscount(
        { ...baseOrder, source: 'physical' },
        baseOrder.order_items ?? []
      )
    ).toBe(false);
  });

  it('does not classify orders after the metadata rollout as legacy', () => {
    expect(
      isLegacyVatInclusiveNegotiationDiscount(
        { ...baseOrder, created_at: '2026-08-27T00:00:00.000Z' },
        baseOrder.order_items ?? []
      )
    ).toBe(false);
  });
});
