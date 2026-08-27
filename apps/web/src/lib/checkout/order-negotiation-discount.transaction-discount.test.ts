import { buildTransactionDiscountLineKey } from '@baci/shared/contracts';
import { describe, expect, it, vi } from 'vitest';
import { computeOrderNegotiationDiscount } from './order-negotiation-discount';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function buildSupabaseMock() {
  const products = [
    {
      brand: 'Apple',
      id: 'p-mac',
      name: 'MacBook Air M1',
      price: 1000,
      vat_category_code: 'S',
      vat_rate: 7.5,
    },
  ];
  const productsQuery = {
    select: () => productsQuery,
    eq: () => productsQuery,
    in: () => productsQuery,
    overrideTypes: () => Promise.resolve({ data: products, error: null }),
  };

  return {
    from: () => productsQuery,
    rpc: () => Promise.resolve({ data: [], error: null }),
  };
}

describe('computeOrderNegotiationDiscount persisted line identity', () => {
  it('preserves distinct condition and variant attributes for duplicate product lines', async () => {
    const result = await computeOrderNegotiationDiscount({
      items: [
        {
          condition: 'new',
          price: 980,
          product_id: 'p-mac',
          quantity: 1,
          variant_attributes: { Color: 'Blue' },
          variant_id: 'v-mac',
        },
        {
          condition: 'used',
          price: 980,
          product_id: 'p-mac',
          quantity: 1,
          variant_attributes: { Color: 'Green' },
          variant_id: 'v-mac',
        },
      ],
      merchantId: 'merchant-1',
      supabase: buildSupabaseMock() as never,
      vatRegistered: true,
    });

    expect(result).toMatchObject({
      rejectionCode: null,
      totalDiscount: 43,
    });
    expect(result?.lineDiscounts).toEqual([
      {
        lineId: 1,
        lineKey: buildTransactionDiscountLineKey({
          condition: 'new',
          productId: 'p-mac',
          variantAttributes: { Color: 'Blue' },
          variantId: 'v-mac',
        }),
        merchandiseDiscount: 20,
        productId: 'p-mac',
        vatRelief: 1.5,
        variantId: 'v-mac',
      },
      {
        lineId: 2,
        lineKey: buildTransactionDiscountLineKey({
          condition: 'used',
          productId: 'p-mac',
          variantAttributes: { Color: 'Green' },
          variantId: 'v-mac',
        }),
        merchandiseDiscount: 20,
        productId: 'p-mac',
        vatRelief: 1.5,
        variantId: 'v-mac',
      },
    ]);
  });
});
