import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
}));

function makeQuery(counts: Record<string, number>, error: unknown = null) {
  let brand = '';
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    or: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockImplementation((_column: string, value: string) => {
    brand = value;
    return query;
  });
  query.or.mockImplementation(() => {
    return Promise.resolve({ count: counts[brand] ?? 0, error });
  });
  return query;
}

describe('getCachedBrandAuthorityEntries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only curated brands that meet the inventory threshold', async () => {
    const queries: ReturnType<typeof makeQuery>[] = [];
    mockGetPublicSupabaseClient.mockReturnValue({
      from: () => {
        const query = makeQuery({ Google: 6, Samsung: 5, Tecno: 4 });
        queries.push(query);
        return query;
      },
    });
    const { getCachedBrandAuthorityEntries } = await import(
      './get-cached-brand-authority-entries'
    );

    const entries = await getCachedBrandAuthorityEntries(
      'merchant-1',
      'smartphones'
    );

    expect(
      entries.map((entry) => [entry.brandKey, entry.productCount])
    ).toEqual([
      ['samsung', 5],
      ['google', 6],
    ]);
    expect(queries).toHaveLength(5);
    expect(queries[0].select).toHaveBeenCalledWith(
      'id, categories:category_id!inner(slug)',
      { count: 'exact', head: true }
    );
    expect(queries[0].or).toHaveBeenCalledWith(
      'manage_stock.is.null,manage_stock.eq.false,stock_quantity.gt.0,stock.gt.0'
    );
  });

  it('fails optional category links open when the query fails', async () => {
    mockGetPublicSupabaseClient.mockReturnValue({
      from: () => makeQuery({}, new Error('timeout')),
    });
    const { getCachedBrandAuthorityEntries } = await import(
      './get-cached-brand-authority-entries'
    );

    await expect(
      getCachedBrandAuthorityEntries('merchant-1', 'smartphones')
    ).resolves.toEqual([]);
  });

  it('skips database work for categories without curated brand hubs', async () => {
    const { getCachedBrandAuthorityEntries } = await import(
      './get-cached-brand-authority-entries'
    );

    await expect(
      getCachedBrandAuthorityEntries('merchant-1', 'laptops')
    ).resolves.toEqual([]);
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
  });
});
