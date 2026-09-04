import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  getPublicSupabaseClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => mocks.cacheLife(...args),
  cacheTag: (...args: unknown[]) => mocks.cacheTag(...args),
}));

vi.mock('@/lib/public-supabase-client', () => ({
  getPublicSupabaseClient: () => mocks.getPublicSupabaseClient(),
}));

import { getCachedCategoryPageShellData } from './cached-category-page-shell';

describe('getCachedCategoryPageShellData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns special-collection shell data without querying Supabase', async () => {
    await expect(
      getCachedCategoryPageShellData('merchant-1', 'new-arrivals')
    ).resolves.toEqual({
      isCollection: true,
      name: 'New Arrivals',
      description: 'Check out the latest additions to our store.',
      fallbackName: 'New Arrivals',
      fallbackDescription: 'Check out the latest additions to our store.',
      productScope: { kind: 'collection', collectionSlug: 'new-arrivals' },
      seo: {
        heading: 'New Arrivals',
        description: 'Check out the latest additions to our store.',
        features: [],
        faqs: [],
      },
    });

    expect(mocks.getPublicSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.cacheLife).toHaveBeenCalledWith('storefront-page');
    expect(mocks.cacheTag).toHaveBeenCalledWith(
      'category-page-data',
      'products',
      'categories',
      'products-merchant-1',
      'categories-merchant-1'
    );
  });
});
