const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockWithSupabaseRetry = jest.fn(
  async (operation: () => Promise<unknown>) => operation()
);

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (...args: unknown[]) =>
    mockWithSupabaseRetry(
      ...(args as Parameters<typeof mockWithSupabaseRetry>)
    ),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) =>
      mockFrom(...(args as Parameters<typeof mockFrom>)),
    rpc: (...args: unknown[]) =>
      mockRpc(...(args as Parameters<typeof mockRpc>)),
  },
}));

import { fetchProductDetails } from '@/lib/storefront-product-details';

describe('fetchProductDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockEq.mockReturnThis();
    mockSelect.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        merchant_id: '22222222-2222-4222-8222-222222222222',
        name: 'iPhone 16',
        slug: 'iphone-16',
        description: 'Phone',
        price: 1250000,
        compare_at_price: 1300000,
        images: ['https://cdn.example.com/iphone-16.png'],
        brand: 'Apple',
        condition: 'New',
        specifications: { display: '6.1-inch' },
        has_variants: true,
        variant_attributes: [
          { param: 'storage', options: ['128GB', '256GB'] },
          { param: 'sim_type', options: ['Physical + eSIM', 'eSIM Only'] },
        ],
        manage_stock: true,
        stock_quantity: 8,
        colors: ['Black', 'White'],
        color_images: {
          Black: ['https://cdn.example.com/iphone-16-black.png'],
        },
        has_condition_offers: false,
        offers: [],
        categories: {
          id: 'phones',
          name: 'Phones',
          slug: 'phones',
        },
      },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });
  });

  it('falls back to an empty variants array when the storefront RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    const product = await fetchProductDetails(
      '22222222-2222-4222-8222-222222222222',
      'iphone-16'
    );

    expect(product.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(product.variant_attributes).toEqual({
      storage: ['128GB', '256GB'],
      sim_type: ['Physical + eSIM', 'eSIM Only'],
    });
    expect(product.variants).toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('get_storefront_product_variants', {
      p_product_ids: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(mockWithSupabaseRetry).toHaveBeenCalled();
  });

  it('returns normalized variants when the storefront RPC succeeds', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          product_id: '11111111-1111-4111-8111-111111111111',
          merchant_id: '22222222-2222-4222-8222-222222222222',
          attributes: {
            storage: '128GB',
            sim_type: 'eSIM Only',
          },
          price_override: 1275000,
          stock_quantity: 2,
          images: ['https://cdn.example.com/iphone-16-esim.png'],
        },
      ],
      error: null,
    });

    const product = await fetchProductDetails(
      '22222222-2222-4222-8222-222222222222',
      'iphone-16'
    );

    expect(product.variant_attributes).toEqual({
      storage: ['128GB', '256GB'],
      sim_type: ['Physical + eSIM', 'eSIM Only'],
    });
    expect(product.variants).toEqual([
      expect.objectContaining({
        id: '33333333-3333-4333-8333-333333333333',
        name: expect.stringMatching(/128GB.*eSIM Only|eSIM Only.*128GB/),
        price_override: 1275000,
        stock_quantity: 2,
        attributes: {
          storage: '128GB',
          sim_type: 'eSIM Only',
        },
      }),
    ]);
    expect(mockRpc).toHaveBeenCalledWith('get_storefront_product_variants', {
      p_product_ids: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(mockWithSupabaseRetry).toHaveBeenCalled();
  });

  it('trims slug identifiers before querying the storefront product row', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchProductDetails(
      '22222222-2222-4222-8222-222222222222',
      ' iphone-16 '
    );

    expect(mockEq).toHaveBeenCalledWith('slug', 'iphone-16');
  });

  it('throws when the product query fails before variant hydration', async () => {
    const productLookupError = {
      code: 'PGRST116',
      message: 'product lookup failed',
      details: 'No rows found',
      hint: null,
    };

    mockSingle.mockResolvedValue({
      data: null,
      error: productLookupError,
    });

    await expect(
      fetchProductDetails(
        '22222222-2222-4222-8222-222222222222',
        'iphone-16'
      )
    ).rejects.toMatchObject(productLookupError);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockWithSupabaseRetry).toHaveBeenCalled();
  });
});
