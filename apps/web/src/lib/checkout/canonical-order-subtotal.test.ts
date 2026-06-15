import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeCanonicalOrderSubtotal,
  computeOrderNegotiationDiscount,
} from '@/lib/checkout/canonical-order-subtotal';

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

describe('computeCanonicalOrderSubtotal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses canonical product prices plus server assurance fees', async () => {
    const { supabase } = buildSupabaseMock({
      products: [{ id: 'p-1', price: 1000 }],
    });

    const subtotal = await computeCanonicalOrderSubtotal({
      items: [
        {
          product_id: 'p-1',
          quantity: 2,
          assurance_fee: 50,
        },
      ],
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(subtotal).toBe(2050);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rounds canonical subtotal values with cent precision', async () => {
    const { supabase } = buildSupabaseMock({
      products: [{ id: 'p-1', price: 1.005 }],
    });

    const subtotal = await computeCanonicalOrderSubtotal({
      items: [
        {
          product_id: 'p-1',
          quantity: 1,
          assurance_fee: 0,
        },
      ],
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(subtotal).toBe(1.01);
  });

  it('uses a matching variant price override when present', async () => {
    const { supabase } = buildSupabaseMock({
      products: [{ id: 'p-1', price: 1000 }],
      variants: [{ id: 'v-1', product_id: 'p-1', price_override: 900 }],
    });

    const subtotal = await computeCanonicalOrderSubtotal({
      items: [
        {
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 1,
          assurance_fee: 0,
        },
      ],
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(subtotal).toBe(900);
    expect(supabase.rpc).toHaveBeenCalledWith('get_order_variant_overrides', {
      p_variant_ids: ['v-1'],
    });
  });

  it('ignores a variant override that belongs to another product', async () => {
    const { supabase } = buildSupabaseMock({
      products: [{ id: 'p-1', price: '1000' }],
      variants: [{ id: 'v-1', product_id: 'p-2', price_override: 700 }],
    });

    const subtotal = await computeCanonicalOrderSubtotal({
      items: [
        {
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 1,
          assurance_fee: 0,
        },
      ],
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(subtotal).toBe(1000);
  });

  it('throws when product prices cannot be loaded', async () => {
    const { supabase } = buildSupabaseMock({
      products: null,
      productsError: { message: 'db unavailable' },
    });

    await expect(
      computeCanonicalOrderSubtotal({
        items: [
          {
            product_id: 'p-1',
            quantity: 1,
            assurance_fee: 0,
          },
        ],
        merchantId: 'merchant-1',
        supabase: supabase as never,
      })
    ).rejects.toThrow('Unable to load products for canonical subtotal parity');
  });
});

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
    ).resolves.toEqual({ totalDiscount: 21.5, rejectionCode: null });
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
    ).resolves.toEqual({ totalDiscount: 20, rejectionCode: null });
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
    ).resolves.toEqual({ totalDiscount: 21.5, rejectionCode: null });
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
    ).resolves.toEqual({ totalDiscount: 21.5, rejectionCode: null });
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
