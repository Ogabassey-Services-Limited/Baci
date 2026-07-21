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
  let equalityCalls = 0;
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockImplementation(() => {
    equalityCalls += 1;
    return equalityCalls === 3 ? Promise.resolve({ data, error }) : query;
  });
  return query;
}

describe('getCachedBrandAuthorityEntries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only curated brands that meet the inventory threshold', async () => {
    const rows = [
      ...Array.from({ length: 5 }, () => ({ brand: 'Samsung' })),
      ...Array.from({ length: 6 }, () => ({ brand: 'Google' })),
      ...Array.from({ length: 4 }, () => ({ brand: 'Tecno' })),
    ];
    mockGetPublicSupabaseClient.mockReturnValue({
      from: () => makeQuery(rows),
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
  });

  it('fails optional category links open when the query fails', async () => {
    mockGetPublicSupabaseClient.mockReturnValue({
      from: () => makeQuery(null, new Error('timeout')),
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
