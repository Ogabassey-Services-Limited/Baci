import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CanonicalOrderSubtotalLoadError,
  computeCanonicalOrderSubtotal,
  isCanonicalOrderSubtotalUuidError,
} from '@/lib/checkout/canonical-order-subtotal';
import { computeOrderNegotiationDiscount } from '@/lib/checkout/order-negotiation-discount';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function buildSupabaseMock({
  products = [],
  productsError = null,
  variants = [],
  variantsError = null,
}: {
  products?: unknown[] | null;
  productsError?: unknown;
  variants?: unknown[] | null;
  variantsError?: unknown;
}) {
  const productsQuery = {
    select: vi.fn(() => productsQuery),
    eq: vi.fn(() => productsQuery),
    in: vi.fn(() => productsQuery),
    returns: vi.fn(() =>
      Promise.resolve({ data: products, error: productsError })
    ),
    overrideTypes: vi.fn(() =>
      Promise.resolve({ data: products, error: productsError })
    ),
  };
  const supabase = {
    from: vi.fn(() => productsQuery),
    rpc: vi.fn(() => Promise.resolve({ data: variants, error: variantsError })),
  };

  return { productsQuery, supabase };
}

const sProduct = (over: Record<string, unknown>) => ({
  vat_category_code: 'S',
  vat_rate: 7.5,
  ...over,
});

describe('computeOrderNegotiationDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives a per-line discount for a negotiated catalog line (VAT-registered)', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 1000,
        }),
      ],
    });

    await expect(
      computeOrderNegotiationDiscount({
        items: [{ product_id: 'p-mac', quantity: 1, price: 980 }],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toEqual({
      lineDiscounts: [{ merchandiseDiscount: 20, vatRelief: 1.5 }],
      totalDiscount: 21.5,
      rejectionCode: null,
    });
  });

  it('omits the VAT gross-up for a non-registered merchant', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 1000,
        }),
      ],
    });

    // No VAT charged → discount is just the 20 price reduction, not 21.5.
    await expect(
      computeOrderNegotiationDiscount({
        items: [{ product_id: 'p-mac', quantity: 1, price: 980 }],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: false,
      })
    ).resolves.toEqual({
      lineDiscounts: [{ merchandiseDiscount: 20, vatRelief: 0 }],
      totalDiscount: 20,
      rejectionCode: null,
    });
  });

  it('flags a non-negotiable line priced below catalog', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-tecno',
          name: 'Tecno Spark 50',
          brand: 'Tecno',
          price: 500,
        }),
      ],
    });

    await expect(
      computeOrderNegotiationDiscount({
        items: [{ product_id: 'p-tecno', quantity: 1, price: 480 }],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toEqual({
      totalDiscount: 0,
      rejectionCode: 'non_negotiable_line_discounted',
    });
  });

  it('honors only the eligible line in a mixed cart', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 1000,
        }),
        sProduct({
          id: 'p-tecno',
          name: 'Tecno Spark 50',
          brand: 'Tecno',
          price: 500,
        }),
      ],
    });

    await expect(
      computeOrderNegotiationDiscount({
        items: [
          { product_id: 'p-mac', quantity: 1, price: 980 },
          { product_id: 'p-tecno', quantity: 1, price: 500 },
        ],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toEqual({
      lineDiscounts: [{ merchandiseDiscount: 20, vatRelief: 1.5 }, null],
      totalDiscount: 21.5,
      rejectionCode: null,
    });
  });

  it('exempts a verified quiz-voucher award line (price 0)', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-award',
          name: 'Free Gift',
          brand: 'Apple',
          price: 5000,
        }),
      ],
    });

    // Pure-voucher order → voucher line excluded → productIds empty → null
    // (no products query, no rejection), even though price 0 ≪ catalog 5000.
    await expect(
      computeOrderNegotiationDiscount({
        items: [
          {
            product_id: 'p-award',
            quantity: 1,
            price: 0,
            voucher_award_id: 'award-1',
          },
        ],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toBeNull();
  });

  it('validates the non-voucher line in a cart that also has a voucher line', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 1000,
        }),
      ],
    });

    await expect(
      computeOrderNegotiationDiscount({
        items: [
          {
            product_id: 'p-award',
            quantity: 1,
            price: 0,
            voucher_award_id: 'award-1',
          }, // exempt
          { product_id: 'p-mac', quantity: 1, price: 980 }, // validated → 21.5
        ],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toEqual({
      lineDiscounts: [{ merchandiseDiscount: 20, vatRelief: 1.5 }],
      totalDiscount: 21.5,
      rejectionCode: null,
    });
  });

  it('computes the discount off a variant price_override when present', async () => {
    // Product catalog price is 5000, but the variant overrides it to 1000.
    // Client offers 980 → reduction 20 = 2% floor; +7.5% VAT = 21.5. Picking
    // distinct prices makes it unambiguous the override (not 5000) was used.
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 5000,
        }),
      ],
      variants: [{ id: 'v-mac', product_id: 'p-mac', price_override: 1000 }],
    });

    await expect(
      computeOrderNegotiationDiscount({
        items: [
          { product_id: 'p-mac', variant_id: 'v-mac', quantity: 1, price: 980 },
        ],
        merchantId: 'merchant-1',
        supabase: supabase as never,
        vatRegistered: true,
      })
    ).resolves.toEqual({
      lineDiscounts: [{ merchandiseDiscount: 20, vatRelief: 1.5 }],
      totalDiscount: 21.5,
      rejectionCode: null,
    });
  });

  it('throws a CanonicalOrderSubtotalLoadError preserving pgCode when the products load fails (22P02)', async () => {
    const { supabase } = buildSupabaseMock({
      products: null,
      productsError: { code: '22P02', message: 'invalid input syntax' },
    });

    const promise = computeOrderNegotiationDiscount({
      items: [{ product_id: 'not-a-uuid', quantity: 1, price: 980 }],
      merchantId: 'merchant-1',
      supabase: supabase as never,
      vatRegistered: true,
    });

    await expect(promise).rejects.toBeInstanceOf(
      CanonicalOrderSubtotalLoadError
    );
    await promise.catch((error) => {
      expect(error).toHaveProperty('pgCode', '22P02');
      expect(isCanonicalOrderSubtotalUuidError(error)).toBe(true);
    });
  });

  it('throws a CanonicalOrderSubtotalLoadError when the variant load fails', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        sProduct({
          id: 'p-mac',
          name: 'MacBook Air M1',
          brand: 'Apple',
          price: 1000,
        }),
      ],
      variants: null,
      variantsError: { code: '08006', message: 'connection failure' },
    });

    const promise = computeOrderNegotiationDiscount({
      items: [
        { product_id: 'p-mac', variant_id: 'v-mac', quantity: 1, price: 980 },
      ],
      merchantId: 'merchant-1',
      supabase: supabase as never,
      vatRegistered: true,
    });

    await expect(promise).rejects.toBeInstanceOf(
      CanonicalOrderSubtotalLoadError
    );
    await promise.catch((error) => {
      expect(error).toHaveProperty('pgCode', '08006');
    });
  });

  it('keeps the existing subtotal helper behavior', async () => {
    const { supabase } = buildSupabaseMock({
      products: [
        { id: 'p-1', name: 'MacBook Air M1', brand: 'Apple', price: 1000 },
      ],
    });

    await expect(
      computeCanonicalOrderSubtotal({
        items: [{ product_id: 'p-1', quantity: 1, assurance_fee: 0 }],
        merchantId: 'merchant-1',
        supabase: supabase as never,
      })
    ).resolves.toBe(1000);
  });
});
