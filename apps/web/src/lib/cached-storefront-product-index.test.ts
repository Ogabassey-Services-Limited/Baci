import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePublicClient = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

vi.mock('@/lib/normalize-product', () => ({
  normalizeProducts: vi.fn((products: unknown[]) =>
    products.map((p: unknown) => ({
      ...(p as Record<string, unknown>),
      normalized: true,
    }))
  ),
}));

import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';

function createQueryBuilder(overrides: {
  data?: unknown[] | null;
  count?: number | null;
  error?: { message: string } | null;
}) {
  const result = {
    data: overrides.data ?? null,
    count: overrides.count ?? null,
    error: overrides.error ?? null,
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

describe('getCachedStorefrontProductIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized products with pagination metadata on success', async () => {
    const rawProducts = [
      { id: 'p1', name: 'Phone', price: 100 },
      { id: 'p2', name: 'Tablet', price: 200 },
    ];

    const builder = createQueryBuilder({
      data: rawProducts,
      count: 25,
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.products).toHaveLength(2);
    expect(result.hasError).toBe(false);
    expect(result.products[0]).toHaveProperty('normalized', true);
    expect(result.errorMessage).toBeNull();
    expect(result.totalCount).toBe(25);
    expect(result.totalPages).toBe(3); // ceil(25/10)
  });

  it('calculates correct offset for page > 1', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 3,
      limit: 10,
    });

    // offset = (3 - 1) * 10 = 20, range = 20..29
    expect(builder.range).toHaveBeenCalledWith(20, 29);
  });

  it('calculates correct offset for page 1', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it('returns empty result on supabase error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const builder = createQueryBuilder({
      error: { message: 'Connection refused' },
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.hasError).toBe(true);
    expect(result.errorMessage).toBe('Connection refused');
    expect(result.products).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching storefront product index:',
      expect.objectContaining({ message: 'Connection refused' })
    );
  });

  it('returns empty products array when data is null', async () => {
    const builder = createQueryBuilder({ data: null, count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.products).toEqual([]);
    expect(result.hasError).toBe(false);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('handles null count by defaulting to 0', async () => {
    const builder = createQueryBuilder({
      data: [{ id: 'p1', name: 'Phone', price: 100 }],
      count: null,
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 10,
    });

    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly with exact division', async () => {
    const builder = createQueryBuilder({ data: [], count: 40 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(result.totalPages).toBe(2); // 40 / 20 = 2
  });

  it('calculates totalPages correctly with remainder', async () => {
    const builder = createQueryBuilder({ data: [], count: 41 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductIndex('merchant-1', {
      page: 1,
      limit: 20,
    });

    expect(result.totalPages).toBe(3); // ceil(41/20) = 3
  });

  it('filters by merchant_id and active status', async () => {
    const builder = createQueryBuilder({ data: [], count: 0 });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductIndex('merchant-abc', {
      page: 1,
      limit: 10,
    });

    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-abc');
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when public client creation fails', async () => {
    mockCreatePublicClient.mockImplementationOnce(() => {
      throw new Error('Supabase configuration is missing');
    });

    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1, limit: 10 })
    ).rejects.toThrow('Supabase configuration is missing');
  });

  it('throws when the requested limit is not a positive integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1, limit: 0 })
    ).rejects.toThrow(
      'Storefront product index limit must be a positive integer'
    );
  });

  it('throws when the requested page is not a positive integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 0, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });
  it('throws when the requested page is negative', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: -1, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });

  it('throws when the requested page is not an integer', async () => {
    await expect(
      getCachedStorefrontProductIndex('merchant-1', { page: 1.5, limit: 10 })
    ).rejects.toThrow(
      'Storefront product index page must be a positive integer'
    );
  });
});
