import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePublicClient = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';

function createQueryBuilder(overrides: {
  data?: Array<{ slug: string | null }> | null;
  error?: { message: string } | null;
}) {
  const result = {
    data: overrides.data ?? null,
    error: overrides.error ?? null,
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => Promise.resolve(result)),
  };

  return builder;
}

describe('getCachedStorefrontProductSlugSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns every product slug for the merchant (any status) as a membership set', async () => {
    const builder = createQueryBuilder({
      data: [
        { slug: 'iphone-15' },
        { slug: 'iphone-15-128gb' }, // archived variant child — must be included
        { slug: 'macbook-air-m1' },
      ],
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(false);
    expect(result.slugs).toEqual([
      'iphone-15',
      'iphone-15-128gb',
      'macbook-air-m1',
    ]);
  });

  it('scopes the query to the merchant and selects only the slug column', async () => {
    const builder = createQueryBuilder({ data: [] });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getCachedStorefrontProductSlugSet('merchant-abc');

    expect(builder.select).toHaveBeenCalledWith('slug');
    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-abc');
  });

  it('drops null/blank slugs defensively', async () => {
    const builder = createQueryBuilder({
      data: [{ slug: 'real' }, { slug: null }, { slug: '  ' }],
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.slugs).toEqual(['real']);
  });

  it('fails open (hasError + empty) on a supabase error so the proxy never hard-404s a live product', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const builder = createQueryBuilder({
      error: { message: 'Connection refused' },
    });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(true);
    expect(result.slugs).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns empty (no error) when data is null', async () => {
    const builder = createQueryBuilder({ data: null });
    mockCreatePublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.hasError).toBe(false);
    expect(result.slugs).toEqual([]);
  });
});
