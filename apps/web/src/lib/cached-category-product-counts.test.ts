import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCachedDataTestHarness,
  type CachedDataTestHarness,
} from '@/lib/cached-data.test-utils';

const mockCreateClient = vi.fn();

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn: unknown) => fn) }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { getCachedCategoryProductCounts } from '@/lib/cached-category-product-counts';

let harness: CachedDataTestHarness;

describe('getCachedCategoryProductCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness = buildCachedDataTestHarness();
    mockCreateClient.mockReturnValue({
      from: harness.mockFrom,
      rpc: harness.mockRpc,
      auth: { getUser: vi.fn() },
    });
  });

  it('counts active products across a category and its active children', async () => {
    harness.mockListResult.data = [
      {
        id: 'product-1',
        product_categories: [{ category_id: 'parent' }],
      },
      {
        id: 'product-2',
        product_categories: [{ category_id: 'child' }],
      },
      {
        id: 'product-2',
        product_categories: [{ category_id: 'parent' }],
      },
    ];
    harness.mockListResult.error = null;

    const result = await getCachedCategoryProductCounts('merchant-1', [
      { id: 'parent', is_active: true, parent_id: null },
      { id: 'child', is_active: true, parent_id: 'parent' },
      { id: 'inactive-child', is_active: false, parent_id: 'parent' },
    ]);

    expect(result).toEqual({ child: 1, parent: 2 });
    expect(harness.mockFrom).toHaveBeenCalledWith('products');
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(harness.mockEq).toHaveBeenCalledWith('status', 'active');
    expect(harness.mockIn).toHaveBeenCalledWith(
      'product_categories.category_id',
      expect.arrayContaining(['parent', 'child'])
    );
  });

  it('returns empty counts when there are no active categories', async () => {
    const result = await getCachedCategoryProductCounts('merchant-1', [
      { id: 'inactive', is_active: false, parent_id: null },
    ]);

    expect(result).toEqual({});
    expect(harness.mockFrom).not.toHaveBeenCalled();
  });

  it('returns empty counts when the count query fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockListResult.data = null;
    harness.mockListResult.error = { message: 'DB timeout' };

    const result = await getCachedCategoryProductCounts('merchant-1', [
      { id: 'parent', is_active: true, parent_id: null },
    ]);

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalled();
  });
});
