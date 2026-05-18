import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  products: [] as unknown[],
  productError: null as { message: string } | null,
  variants: [] as unknown[],
  variantError: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

function buildSupabaseMock() {
  const productsQuery = {
    select: vi.fn(() => productsQuery),
    in: vi.fn(() => productsQuery),
    returns: vi.fn(() =>
      Promise.resolve({ data: mocks.products, error: mocks.productError })
    ),
  };
  const variantsQuery = {
    select: vi.fn(() => variantsQuery),
    in: vi.fn(() => variantsQuery),
    returns: vi.fn(() =>
      Promise.resolve({ data: mocks.variants, error: mocks.variantError })
    ),
  };
  const supabase = {
    from: vi.fn((table: string) =>
      table === 'product_variants' ? variantsQuery : productsQuery
    ),
  };

  return { productsQuery, supabase, variantsQuery };
}

function postCartValidate(body: unknown) {
  return POST(
    new Request('https://example.com/api/cart/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as never
  );
}

describe('POST /api/cart/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.products = [];
    mocks.productError = null;
    mocks.variants = [];
    mocks.variantError = null;
  });

  it('reports stale selected-variant prices against the variant override', async () => {
    const { supabase, productsQuery, variantsQuery } = buildSupabaseMock();
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.products = [
      {
        id: PRODUCT_ID,
        name: 'iPhone 15',
        price: 370_000,
        stock: 5,
        stock_quantity: 5,
        status: 'active',
        manage_stock: true,
      },
    ];
    mocks.variants = [
      {
        id: VARIANT_ID,
        product_id: PRODUCT_ID,
        price_override: 320_000,
      },
    ];

    const response = await postCartValidate({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 370_000,
          variantId: VARIANT_ID,
        },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(supabase.from).toHaveBeenCalledWith('product_variants');
    expect(productsQuery.in).toHaveBeenCalledWith('id', [PRODUCT_ID]);
    expect(variantsQuery.in).toHaveBeenCalledWith('id', [VARIANT_ID]);
    expect(body.priceChanges).toEqual([
      {
        id: PRODUCT_ID,
        variantId: VARIANT_ID,
        oldPrice: 370_000,
        newPrice: 320_000,
      },
    ]);
    expect(body.validProducts[0]).toMatchObject({
      id: PRODUCT_ID,
      price: 320_000,
    });
  });

  it('keeps variant price changes scoped to the matching product variant', async () => {
    const { supabase } = buildSupabaseMock();
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.products = [
      {
        id: PRODUCT_ID,
        name: 'iPhone 15',
        price: 370_000,
        stock: 5,
        stock_quantity: 5,
        status: 'active',
        manage_stock: true,
      },
      {
        id: OTHER_PRODUCT_ID,
        name: 'iPhone 15 Pro',
        price: 780_000,
        stock: 5,
        stock_quantity: 5,
        status: 'active',
        manage_stock: true,
      },
    ];
    mocks.variants = [
      {
        id: VARIANT_ID,
        product_id: PRODUCT_ID,
        price_override: 320_000,
      },
    ];

    const response = await postCartValidate({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 370_000,
          variantId: VARIANT_ID,
        },
        {
          id: OTHER_PRODUCT_ID,
          price: 780_000,
          variantId: VARIANT_ID,
        },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.priceChanges).toEqual([
      {
        id: PRODUCT_ID,
        variantId: VARIANT_ID,
        oldPrice: 370_000,
        newPrice: 320_000,
      },
    ]);
  });

  it('returns 500 when variant prices cannot be loaded', async () => {
    const { supabase } = buildSupabaseMock();
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.products = [
      {
        id: PRODUCT_ID,
        name: 'iPhone 15',
        price: 370_000,
        stock: 5,
        stock_quantity: 5,
        status: 'active',
        manage_stock: true,
      },
    ];
    mocks.variantError = { message: 'variant query failed' };

    const response = await postCartValidate({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 370_000,
          variantId: VARIANT_ID,
        },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('variant query failed');
  });
});
