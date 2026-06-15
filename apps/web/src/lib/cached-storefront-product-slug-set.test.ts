import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAdminClient = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';

/**
 * Builder whose `.range()` resolves the queued page results in order, so
 * pagination can be exercised. Each entry is one `.range()` call's result.
 */
function createQueryBuilder(
  pages: {
    data?: { slug: string | null }[] | null;
    error?: { message: string } | null;
  }[]
) {
  const rangeCalls: [number, number][] = [];
  let call = 0;

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      const page = pages[call] ?? { data: [] };
      call += 1;
      return Promise.resolve({
        data: page.data ?? null,
        error: page.error ?? null,
      });
    }),
  };

  return { builder, rangeCalls };
}

function rows(n: number, prefix = 'p'): { slug: string }[] {
  return Array.from({ length: n }, (_, i) => ({ slug: `${prefix}-${i}` }));
}

describe('getCachedStorefrontProductSlugSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns every product slug for the merchant in a single page', async () => {
    const { builder, rangeCalls } = createQueryBuilder([
      { data: [{ slug: 'iphone-15' }, { slug: 'macbook-air-m1' }] },
    ]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(false);
    expect(result.slugs).toEqual(['iphone-15', 'macbook-air-m1']);
    expect(rangeCalls[0]).toEqual([0, 999]); // first page is rows 0..999
  });

  it('uses the service-role admin client and selects all statuses scoped to the merchant', async () => {
    const { builder } = createQueryBuilder([{ data: [] }]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductSlugSet('merchant-abc');

    expect(mockCreateAdminClient).toHaveBeenCalled();
    expect(builder.select).toHaveBeenCalledWith('slug');
    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-abc');
    // No `.eq('status', 'active')` — archived slugs must be included so the
    // proxy never 404s a slug the page would legacy-308.
    expect(builder.eq).not.toHaveBeenCalledWith('status', 'active');
  });

  it('paginates through every row when a merchant exceeds the page cap', async () => {
    const { builder, rangeCalls } = createQueryBuilder([
      { data: rows(1000, 'a') }, // full page → keep paging
      { data: rows(5, 'b') }, // partial page → stop
    ]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(false);
    expect(result.slugs).toHaveLength(1005);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('drops null/blank slugs defensively', async () => {
    const { builder } = createQueryBuilder([
      { data: [{ slug: 'real' }, { slug: null }, { slug: '  ' }] },
    ]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.slugs).toEqual(['real']);
  });

  it('fails open (hasError + empty) on a supabase error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { builder } = createQueryBuilder([
      { error: { message: 'Connection refused' } },
    ]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(true);
    expect(result.slugs).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('fails open if a page error occurs partway through pagination', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { builder } = createQueryBuilder([
      { data: rows(1000, 'a') },
      { error: { message: 'transient' } },
    ]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(true);
    expect(result.slugs).toEqual([]);
  });

  it('returns empty (no error) when data is null', async () => {
    const { builder } = createQueryBuilder([{ data: null }]);
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(false);
    expect(result.slugs).toEqual([]);
  });
});
