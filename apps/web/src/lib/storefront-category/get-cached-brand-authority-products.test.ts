import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
}));

function makeQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data, error });
  return query;
}

describe('getCachedBrandAuthorityProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a bounded brand, category, active, and in-stock query', async () => {
    const query = makeQuery([{ id: 'product-1' }]);
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
    ).resolves.toEqual([{ id: 'product-1' }]);

    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('categories.slug', 'smartphones');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.ilike).toHaveBeenCalledWith('brand', 'Samsung');
    expect(query.or).toHaveBeenCalledWith(
      'manage_stock.is.null,manage_stock.eq.false,stock_quantity.gt.0,stock.gt.0'
    );
    expect(query.limit).toHaveBeenCalledWith(48);
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
