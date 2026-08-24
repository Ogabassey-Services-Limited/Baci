import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedCompareCategoryShell } from './get-cached-compare-category-shell';

const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: (...args: string[]) => mockCacheLife(...args),
  cacheTag: (...args: string[]) => mockCacheTag(...args),
}));

vi.mock('@/lib/public-supabase-client', () => ({
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
}));

function createCategoryQuery(result: { data?: unknown; error?: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    or: vi.fn(() => Promise.resolve({ data: [], error: null })),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe('getCachedCompareCategoryShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns collection scope without querying Supabase', async () => {
    const from = vi.fn();
    mockGetPublicSupabaseClient.mockReturnValue({ from });

    await expect(
      getCachedCompareCategoryShell('merchant-1', 'new-arrivals', 'store')
    ).resolves.toEqual({
      fallbackName: 'New Arrivals',
      isCollection: true,
      productScope: { kind: 'collection', collectionSlug: 'new-arrivals' },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('returns active category scope including active descendants', async () => {
    const categoryQuery = createCategoryQuery({
      data: { id: 'cat-1', is_active: true, name: 'Laptops' },
      error: null,
    });
    const categoryScopeQuery = {
      eq: vi.fn(() => categoryScopeQuery),
      or: vi.fn(() =>
        Promise.resolve({
          data: [{ id: 'cat-1' }, { id: 'cat-2' }],
          error: null,
        })
      ),
      select: vi.fn(() => categoryScopeQuery),
    };
    mockGetPublicSupabaseClient.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(categoryQuery)
        .mockReturnValueOnce(categoryScopeQuery),
    });

    await expect(
      getCachedCompareCategoryShell('merchant-1', 'laptops', 'store')
    ).resolves.toEqual({
      fallbackName: 'Laptops',
      isCollection: false,
      productScope: {
        kind: 'category',
        categoryId: 'cat-1',
        categoryIds: ['cat-1', 'cat-2'],
      },
    });
  });

  it('uses legacy scope for a missing category and honors hidden slug state', async () => {
    const missingCategoryQuery = createCategoryQuery({
      data: null,
      error: { code: 'PGRST116' },
    });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockGetPublicSupabaseClient.mockReturnValue({
      from: vi.fn(() => missingCategoryQuery),
      rpc,
    });

    await expect(
      getCachedCompareCategoryShell('merchant-1', 'retro-consoles', 'store')
    ).resolves.toEqual({
      fallbackName: 'Retro Consoles',
      isCollection: false,
      productScope: { kind: 'legacy', categoryName: 'Retro Consoles' },
    });
    expect(rpc).toHaveBeenCalledWith('get_storefront_category_slug_state', {
      p_merchant_id: 'merchant-1',
      p_slug: 'retro-consoles',
    });

    rpc.mockResolvedValueOnce({
      data: [{ is_active: false }],
      error: null,
    });
    await expect(
      getCachedCompareCategoryShell('merchant-1', 'hidden', 'store')
    ).resolves.toMatchObject({
      productScope: { kind: 'none' },
    });
  });
});
