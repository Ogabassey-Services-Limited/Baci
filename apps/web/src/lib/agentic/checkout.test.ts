import { describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';

function createQueryChain(data: unknown[], error: unknown = null) {
  const chain = {
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn().mockResolvedValue({ data: error ? null : data, error }),
    select: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function createCheckoutSupabase(productQuery: unknown, variantQuery: unknown) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return productQuery;
      }
      if (table === 'product_variants') {
        return variantQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('calculateCheckoutSession', () => {
  it('scopes product and variant lookups to the merchant', async () => {
    const productQuery = createQueryChain([
      {
        id: 'product-1',
        manage_stock: true,
        name: 'Phone',
        price: 500000,
        stock: 4,
        stock_quantity: 4,
      },
    ]);
    const variantQuery = createQueryChain([]);
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'product-1', quantity: 1 }],
      null,
      'NGN',
      'merchant-1'
    );

    expect(result.messages).toEqual([]);
    expect(productQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(variantQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('treats unmanaged product stock as unlimited', async () => {
    const productQuery = createQueryChain([
      {
        id: 'product-1',
        manage_stock: false,
        name: 'Phone',
        price: 500000,
        stock: 0,
        stock_quantity: 0,
      },
    ]);
    const variantQuery = createQueryChain([]);
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'product-1', quantity: 9 }],
      null,
      'NGN',
      'merchant-1'
    );

    expect(result.messages).toEqual([]);
  });

  it('keeps variant line items tied to parent products', async () => {
    const productQuery = createQueryChain([]);
    const variantQuery = createQueryChain([
      {
        attributes: { color: 'Black' },
        id: 'variant-1',
        merchant_id: 'merchant-1',
        price_override: 550000,
        product: { manage_stock: false, name: 'Phone', price: 500000 },
        product_id: 'product-1',
        stock_quantity: 0,
      },
    ]);
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'variant-1', quantity: 2 }],
      null,
      'NGN',
      'merchant-1'
    );

    expect(result.messages).toEqual([]);
    expect(result.lineItems[0]?.item).toMatchObject({
      id: 'variant-1',
      product_id: 'product-1',
      variant_attributes: { color: 'Black' },
      variant_id: 'variant-1',
    });
  });

  it('returns an error message instead of adding unpriced variants', async () => {
    const productQuery = createQueryChain([]);
    const variantQuery = createQueryChain([
      {
        attributes: { color: 'Black' },
        id: 'variant-1',
        merchant_id: 'merchant-1',
        price_override: null,
        product: { manage_stock: false, name: 'Phone', price: null },
        product_id: 'product-1',
        stock_quantity: 0,
      },
    ]);
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'variant-1', quantity: 2 }],
      null,
      'NGN',
      'merchant-1'
    );

    expect(result.lineItems).toEqual([]);
    expect(result.messages).toContainEqual(
      expect.objectContaining({
        code: 'missing_price',
        content: expect.stringContaining('variant-1'),
        path: '$.items[0]',
        type: 'error',
      })
    );
  });

  it('fails when product lookup returns a database error', async () => {
    const productQuery = createQueryChain([], { message: 'query failed' });
    const variantQuery = createQueryChain([]);
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    await expect(
      calculateCheckoutSession(
        supabase as never,
        [{ id: 'product-1', quantity: 1 }],
        null,
        'NGN',
        'merchant-1'
      )
    ).rejects.toThrow('Failed to load checkout products');
  });

  it('fails when variant lookup returns a database error', async () => {
    const productQuery = createQueryChain([]);
    const variantQuery = createQueryChain([], { message: 'query failed' });
    const supabase = createCheckoutSupabase(productQuery, variantQuery);

    await expect(
      calculateCheckoutSession(
        supabase as never,
        [{ id: 'variant-1', quantity: 1 }],
        null,
        'NGN',
        'merchant-1'
      )
    ).rejects.toThrow('Failed to load checkout product variants');
  });
});
