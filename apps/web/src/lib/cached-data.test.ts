import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import {
  getCachedCategories,
  getCachedFeatureSettings,
  getCachedProductRatingStats,
  getCachedProducts,
  getPublicSupabaseClient,
} from '@/lib/cached-data';

let harness: CachedDataTestHarness;

const _DEFAULT_DISABLED_SETTINGS = {
  blog_enabled: false,
  shipping_insurance_enabled: false,
  shipping_insurance_min_order_value: 5000,
  shipping_insurance_opt_in_default: false,
};

describe('getPublicSupabaseClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({ from: vi.fn() });
  });

  it('creates a Supabase client with correct URL and key', () => {
    getPublicSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: false,
        }),
      })
    );
  });

  it('throws when Supabase URL is missing', () => {
    vi.mocked(getSupabaseUrl).mockReturnValueOnce('');

    expect(() => getPublicSupabaseClient()).toThrow(
      'Supabase configuration is missing'
    );
  });

  it('throws when Supabase anon key is missing', () => {
    vi.mocked(getSupabaseAnonKey).mockReturnValueOnce('');

    expect(() => getPublicSupabaseClient()).toThrow(
      'Supabase configuration is missing'
    );
  });
});

describe('getCachedCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness = buildCachedDataTestHarness();
    mockCreateClient.mockReturnValue({
      from: harness.mockFrom,
      rpc: harness.mockRpc,
      auth: { getUser: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns categories on success', async () => {
    const categories = [
      { id: 'c1', name: 'Electronics', slug: 'electronics' },
      { id: 'c2', name: 'Fashion', slug: 'fashion' },
    ];

    harness.mockListResult.data = categories;
    harness.mockListResult.error = null;

    const result = await getCachedCategories('merchant-1');

    expect(result).toEqual(categories);
    expect(harness.mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(harness.mockOrder).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('returns empty array on error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockListResult.data = null;
    harness.mockListResult.error = { message: 'DB timeout' };

    const result = await getCachedCategories('merchant-1');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns empty array when data is null', async () => {
    harness.mockListResult.data = null;
    harness.mockListResult.error = null;

    const result = await getCachedCategories('merchant-1');

    expect(result).toEqual([]);
  });
});

describe('getCachedFeatureSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness = buildCachedDataTestHarness();
    mockCreateClient.mockReturnValue({
      from: harness.mockFrom,
      rpc: harness.mockRpc,
      auth: { getUser: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns feature settings from database on success', async () => {
    const settings = {
      blog_enabled: true,
      blog_discover_image_validation_enabled: true,
      shipping_insurance_enabled: true,
      shipping_insurance_min_order_value: 10000,
      shipping_insurance_opt_in_default: true,
    };

    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: settings,
      error: null,
      count: null,
    });

    const result = await getCachedFeatureSettings('merchant-1');

    expect(result).toEqual(settings);
    expect(harness.mockSelect).toHaveBeenCalledWith(
      'blog_enabled, blog_discover_image_validation_enabled, shipping_insurance_enabled, shipping_insurance_min_order_value, shipping_insurance_opt_in_default'
    );
  });

  it('throws on Supabase error instead of returning defaults', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
      count: null,
    });

    await expect(getCachedFeatureSettings('merchant-1')).rejects.toMatchObject({
      message: 'Not found',
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('throws when Supabase client creation fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockCreateClient.mockImplementation(() => {
      throw new Error('Missing service key');
    });

    await expect(getCachedFeatureSettings('merchant-1')).rejects.toThrow(
      'Missing service key'
    );
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns null when no settings row exists', async () => {
    harness.mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
      count: null,
    });

    const result = await getCachedFeatureSettings('merchant-1');

    expect(result).toBeNull();
  });
});

describe('getCachedProductRatingStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness = buildCachedDataTestHarness();
    mockCreateClient.mockReturnValue({
      from: harness.mockFrom,
      rpc: harness.mockRpc,
      auth: { getUser: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correct stats for a set of reviews', async () => {
    const reviews = [
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 1 },
    ];

    harness.mockListResult.data = reviews;
    harness.mockListResult.error = null;

    const result = await getCachedProductRatingStats('product-1');

    expect(result.totalReviews).toBe(5);
    expect(result.averageRating).toBe(3.6); // (5+5+4+3+1)/5 = 3.6
    expect(result.distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1, 5: 2 });
  });

  it('returns zeros when there are no reviews', async () => {
    harness.mockListResult.data = [];
    harness.mockListResult.error = null;

    const result = await getCachedProductRatingStats('product-1');

    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
    expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('returns zeros on error', async () => {
    harness.mockListResult.data = null;
    harness.mockListResult.error = { message: 'Connection error' };

    const result = await getCachedProductRatingStats('product-1');

    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('returns zeros when data is null', async () => {
    harness.mockListResult.data = null;
    harness.mockListResult.error = null;

    const result = await getCachedProductRatingStats('product-1');

    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('rounds averageRating to one decimal place', async () => {
    // 3 reviews: 5, 4, 4 => avg 4.333... => rounded to 4.3
    const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 4 }];
    harness.mockListResult.data = reviews;
    harness.mockListResult.error = null;

    const result = await getCachedProductRatingStats('product-1');

    expect(result.averageRating).toBe(4.3);
  });
});

describe('getCachedProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness = buildCachedDataTestHarness();
    mockCreateClient.mockReturnValue({
      from: harness.mockFrom,
      rpc: harness.mockRpc,
      auth: { getUser: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array on error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    harness.mockListResult.data = null;
    harness.mockListResult.error = { message: 'Connection error' };
    harness.mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getCachedProducts('merchant-1');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching products:',
      expect.objectContaining({ message: 'Connection error' })
    );
  });

  it('returns products with merged variants on success', async () => {
    const products = [
      { id: 'p1', name: 'Phone', status: 'active' },
      { id: 'p2', name: 'Tablet', status: 'active' },
    ];

    harness.mockListResult.data = products;
    harness.mockListResult.error = null;
    harness.mockRpc.mockResolvedValueOnce({
      data: [{ product_id: 'p1', id: 'v1', attributes: { color: 'red' } }],
      error: null,
    });

    const result = await getCachedProducts('merchant-1');

    expect(result).toHaveLength(2);
    // Product with variant
    expect(result[0].product_variants).toHaveLength(1);
    // Product without variant
    expect(result[1].product_variants).toEqual([]);
  });
});
