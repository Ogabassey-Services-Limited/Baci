import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { computeAgenticOrderTax } from './checkout-order-tax';

type FromHandler = (table: string) => unknown;

function buildSupabaseMock(handlers: {
  merchant?: { vat_registration_status: string | null };
  products?: Array<{
    id: string;
    price: number | string | null;
    vat_category_code: string | null;
    vat_rate: number | string | null;
  }>;
  variants?: Array<{
    id: string;
    price_override: number | string | null;
  }>;
}): SupabaseClient {
  const from: FromHandler = (table: string) => {
    if (table === 'merchants') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: handlers.merchant ?? null,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === 'products') {
      return {
        select: () => ({
          in: () => ({
            returns: () =>
              Promise.resolve({ data: handlers.products ?? [], error: null }),
          }),
        }),
      };
    }
    if (table === 'product_variants') {
      return {
        select: () => ({
          in: () => ({
            returns: () =>
              Promise.resolve({ data: handlers.variants ?? [], error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

describe('computeAgenticOrderTax', () => {
  it('returns 0 when the merchant is not VAT-registered', async () => {
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'not_registered' },
    });

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', quantity: 2 }],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(0);
  });

  it('returns 0 when items[] is empty', async () => {
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
    });

    const result = await computeAgenticOrderTax({
      items: [],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(0);
  });

  it("computes per-line tax for a single 'S' product at the merchant's default rate", async () => {
    // Product price 10000, qty 2, category 'S', rate 7.5
    // line_extension = ROUND(2 * 10000, 2) = 20000
    // tax = ROUND(20000 * 7.5 / 100, 2) = 1500
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-1',
          price: 10000,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', quantity: 2 }],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(1500);
  });

  it("treats NULL vat_category_code as 'S' (column default)", async () => {
    // Mirrors `populate_order_item_tax`: when product.vat_category_code
    // IS NULL, NEW.vat_category_code stays at the order_items column
    // default 'S' and the trigger charges VAT. Round 4 regression.
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-1',
          price: 1000,
          vat_category_code: null,
          vat_rate: 7.5,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', quantity: 1 }],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(75);
  });

  it('treats NULL vat_rate as 7.5 (column default, not merchant rate)', async () => {
    // Same trigger semantics: NEW.vat_rate falls back to the column
    // default 7.5, NOT the merchant's configured rate. Mirroring
    // exactly so RPC + dispatch agree.
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-1',
          price: 2000,
          vat_category_code: 'S',
          vat_rate: null,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', quantity: 1 }],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(150); // ROUND(2000 * 7.5 / 100, 2)
  });

  it("contributes 0 for non-'S' categories (O / Z / exempt)", async () => {
    // Mixed-category cart: 'S' contributes, 'O' does not.
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-s',
          price: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
        {
          id: 'prod-o',
          price: 5000,
          vat_category_code: 'O',
          vat_rate: 7.5,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [
        { product_id: 'prod-s', quantity: 1 }, // 75
        { product_id: 'prod-o', quantity: 1 }, // 0
      ],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(75);
  });

  it('uses variant.price_override when variant_id is provided', async () => {
    // Mirrors RPC: COALESCE(t.price_override, t.base_price). The
    // variant override (5000) wins over the product price (1000).
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-1',
          price: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
      variants: [{ id: 'var-1', price_override: 5000 }],
    });

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 1 }],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(375); // ROUND(5000 * 7.5 / 100, 2)
  });

  it('skips items whose product cannot be resolved', async () => {
    // Defensive: a stale product_id in the payload doesn't blow up
    // — the RPC will reject with `invalid_items` separately. The
    // helper just contributes 0 for the missing line.
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-1',
          price: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [
        { product_id: 'prod-1', quantity: 1 }, // 75
        { product_id: 'prod-missing', quantity: 5 }, // 0
      ],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(75);
  });

  it('skips items with non-positive quantity or price', async () => {
    const supabase = buildSupabaseMock({
      merchant: { vat_registration_status: 'registered' },
      products: [
        {
          id: 'prod-zero-price',
          price: 0,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
        {
          id: 'prod-valid',
          price: 1000,
          vat_category_code: 'S',
          vat_rate: 7.5,
        },
      ],
    });

    const result = await computeAgenticOrderTax({
      items: [
        { product_id: 'prod-zero-price', quantity: 1 }, // 0
        { product_id: 'prod-valid', quantity: 0 }, // 0
        { product_id: 'prod-valid', quantity: 1 }, // 75
      ],
      merchantId: 'm-1',
      supabase,
    });

    expect(result).toBe(75);
  });

  it('throws when the merchants lookup returns an error (Codex P2)', async () => {
    // A transient DB/RLS failure used to be swallowed as "not
    // registered" → tax 0 → RPC tax_amount_mismatch → 400. That
    // hid infra errors and broke retry semantics. Now we throw
    // so the dispatch surfaces a 500.
    const supabase = {
      from: (table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'connection timeout' },
                  }),
              }),
            }),
          };
        }
        throw new Error('should not query products on merchant error');
      },
    } as unknown as SupabaseClient;

    await expect(
      computeAgenticOrderTax({
        items: [{ product_id: 'prod-1', quantity: 1 }],
        merchantId: 'm-1',
        supabase,
      })
    ).rejects.toThrow(/Failed to load merchant VAT status/);
  });

  it('throws when the products lookup returns an error (Codex P2)', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              in: () => ({
                returns: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'rls deny' },
                  }),
              }),
            }),
          };
        }
        throw new Error('unexpected');
      },
    } as unknown as SupabaseClient;

    await expect(
      computeAgenticOrderTax({
        items: [{ product_id: 'prod-1', quantity: 1 }],
        merchantId: 'm-1',
        supabase,
      })
    ).rejects.toThrow(/Failed to load products for VAT computation/);
  });

  it('throws when the product_variants lookup returns an error (Codex P2)', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              in: () => ({
                returns: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'prod-1',
                        price: 1000,
                        vat_category_code: 'S',
                        vat_rate: 7.5,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'product_variants') {
          return {
            select: () => ({
              in: () => ({
                returns: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'variants query failed' },
                  }),
              }),
            }),
          };
        }
        throw new Error('unexpected');
      },
    } as unknown as SupabaseClient;

    await expect(
      computeAgenticOrderTax({
        items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 1 }],
        merchantId: 'm-1',
        supabase,
      })
    ).rejects.toThrow(/Failed to load product variants for VAT computation/);
  });

  it('does not query products when the merchant lookup returns nothing', async () => {
    // Defensive: a deleted merchant id (race) returns null. We
    // treat that as not-registered and return 0 without further
    // queries — matches the RPC's "non-registered → tax_amount = 0"
    // semantics.
    const productsSelect = vi.fn();
    const supabase = {
      from: (table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'products') {
          productsSelect();
          return {
            select: () => ({
              in: () => ({
                returns: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        throw new Error('unexpected');
      },
    } as unknown as SupabaseClient;

    const result = await computeAgenticOrderTax({
      items: [{ product_id: 'prod-1', quantity: 1 }],
      merchantId: 'missing-merchant',
      supabase,
    });

    expect(result).toBe(0);
    expect(productsSelect).not.toHaveBeenCalled();
  });
});
