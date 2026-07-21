import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPublicSupabaseClient = vi.fn();
const mockHydrateAndSanitizeProducts = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
  hydrateAndSanitizeProducts: (...args: unknown[]) =>
    mockHydrateAndSanitizeProducts(...args),
}));

function makeQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue({ data, error });
  return query;
}

describe('getCachedBrandAuthorityProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydrateAndSanitizeProducts.mockImplementation(
      async (_supabase: unknown, _merchantId: unknown, products: unknown) =>
        products
    );
  });

  it('hydrates public inventory before returning a bounded display selection', async () => {
    const query = makeQuery([
      { id: 'product-1', name: 'Samsung Galaxy', price: 100, stock: 1 },
    ]);
    mockGetPublicSupabaseClient.mockReturnValue({ from: () => query });
    const { brandAuthorityTaxonomy } = await import(
      './brand-authority-taxonomy'
    );
    const { getCachedBrandAuthorityProducts } = await import(
      './get-cached-brand-authority-products'
    );
    const entry = brandAuthorityTaxonomy.getEntry('smartphones', 'samsung');
    if (!entry) {
      throw new Error('Expected Samsung taxonomy entry');
    }

    await expect(
      getCachedBrandAuthorityProducts('merchant-1', 'smartphones', entry)
    ).resolves.toEqual([
      { id: 'product-1', name: 'Samsung Galaxy', price: 100, stock: 1 },
    ]);

    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith(
      'product_categories.categories.slug',
      'smartphones'
    );
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.ilike).toHaveBeenCalledWith('brand', 'Samsung');
    expect(query.or).toHaveBeenCalledWith(
      'is_parent.eq.true,parent_product_id.is.null'
    );
    expect(mockHydrateAndSanitizeProducts).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      expect.any(Array)
    );
    expect(query.range).toHaveBeenCalledWith(0, 99);
    expect(query.order).toHaveBeenNthCalledWith(1, 'updated_at', {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
  });

  it('marks a full qualified page as a lower-bound inventory count', async () => {
    const query = makeQuery(
      Array.from({ length: 100 }, (_, index) => ({
        id: `product-${index}`,
        name: `Samsung Galaxy ${index}`,
        price: 100,
        stock: 1,
      }))
    );
    mockGetPublicSupabaseClient.mockReturnValue({ from: () => query });
    const { brandAuthorityTaxonomy } = await import(
      './brand-authority-taxonomy'
    );
    const { getCachedBrandAuthorityInventory } = await import(
      './get-cached-brand-authority-inventory'
    );
    const entry = brandAuthorityTaxonomy.getEntry('smartphones', 'samsung');
    if (!entry) throw new Error('Expected Samsung taxonomy entry');

    await expect(
      getCachedBrandAuthorityInventory('merchant-1', 'smartphones', entry)
    ).resolves.toEqual(
      expect.objectContaining({
        productCount: 100,
        productCountIsLowerBound: true,
      })
    );
  });

  it('uses serialized public availability instead of stale product stock', async () => {
    const product = {
      id: 'product-1',
      name: 'Samsung Galaxy',
      price: 100,
      stock: 4,
      manage_stock: true,
    };
    const query = makeQuery([product]);
    mockGetPublicSupabaseClient.mockReturnValue({ from: () => query });
    mockHydrateAndSanitizeProducts.mockResolvedValue([
      { ...product, stock: 0, stock_quantity: 0, manage_stock: true },
    ]);
    const { brandAuthorityTaxonomy } = await import(
      './brand-authority-taxonomy'
    );
    const { getCachedBrandAuthorityProducts } = await import(
      './get-cached-brand-authority-products'
    );
    const entry = brandAuthorityTaxonomy.getEntry('smartphones', 'samsung');
    if (!entry) throw new Error('Expected Samsung taxonomy entry');

    await expect(
      getCachedBrandAuthorityProducts('merchant-1', 'smartphones', entry)
    ).resolves.toEqual([]);
  });

  it('keeps serialized-then-unlimited products that hydrate as purchasable', async () => {
    const product = {
      id: 'product-1',
      name: 'Samsung Galaxy',
      price: 100,
      stock: 0,
      manage_stock: true,
    };
    const query = makeQuery([product]);
    mockGetPublicSupabaseClient.mockReturnValue({ from: () => query });
    mockHydrateAndSanitizeProducts.mockResolvedValue([
      { ...product, stock: 9999, manage_stock: false },
    ]);
    const { brandAuthorityTaxonomy } = await import(
      './brand-authority-taxonomy'
    );
    const { getCachedBrandAuthorityProducts } = await import(
      './get-cached-brand-authority-products'
    );
    const entry = brandAuthorityTaxonomy.getEntry('smartphones', 'samsung');
    if (!entry) throw new Error('Expected Samsung taxonomy entry');

    await expect(
      getCachedBrandAuthorityProducts('merchant-1', 'smartphones', entry)
    ).resolves.toEqual([{ ...product, stock: 9999, manage_stock: false }]);
  });

  it('propagates query failures so callers do not publish incomplete hubs', async () => {
    const query = makeQuery(null, new Error('timeout'));
    mockGetPublicSupabaseClient.mockReturnValue({ from: () => query });
    const { brandAuthorityTaxonomy } = await import(
      './brand-authority-taxonomy'
    );
    const { getCachedBrandAuthorityProducts } = await import(
      './get-cached-brand-authority-products'
    );
    const entry = brandAuthorityTaxonomy.getEntry('smartphones', 'samsung');
    if (!entry) {
      throw new Error('Expected Samsung taxonomy entry');
    }

    await expect(
      getCachedBrandAuthorityProducts('merchant-1', 'smartphones', entry)
    ).rejects.toThrow('timeout');
  });
});
