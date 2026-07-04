import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPublicSupabaseClient } = vi.hoisted(() => ({
  mockGetPublicSupabaseClient: vi.fn(),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: mockGetPublicSupabaseClient,
}));

import { cacheLife, cacheTag } from 'next/cache';
import { getCachedDeadContentLinkSlugs } from '@/lib/cached-dead-content-links';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
  };

  Object.defineProperty(builder, 'then', {
    value: (
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void
    ) => Promise.resolve(result).then(resolve, reject),
  });

  return builder;
}

function setupSupabaseMock({
  blogResult = { data: [], error: null },
  productResult = { data: [], error: null },
}: {
  blogResult?: QueryResult;
  productResult?: QueryResult;
} = {}) {
  const blogBuilder = createQueryBuilder(blogResult);
  const productBuilder = createQueryBuilder(productResult);

  const from = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      return { select: vi.fn(() => blogBuilder) };
    }
    if (table === 'products') {
      return { select: vi.fn(() => productBuilder) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  mockGetPublicSupabaseClient.mockReturnValue({ from });

  return { blogBuilder, from, productBuilder };
}

describe('getCachedDeadContentLinkSlugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty results without querying supabase when no slugs are given', async () => {
    const { from } = setupSupabaseMock();

    const result = await getCachedDeadContentLinkSlugs('merchant-1', [], []);

    expect(result).toEqual({ blog: [], products: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('sets merchant-scoped cache lifetime and tags', async () => {
    setupSupabaseMock();

    await getCachedDeadContentLinkSlugs('merchant-1', ['draft-post'], []);

    expect(cacheLife).toHaveBeenCalledWith('merchant');
    expect(cacheTag).toHaveBeenCalledWith('blog-posts', 'products-merchant-1');
  });

  it('returns requested blog slugs that have no live published post', async () => {
    const { blogBuilder } = setupSupabaseMock({
      blogResult: { data: [{ slug: 'live-post' }], error: null },
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      ['live-post', 'draft-post'],
      []
    );

    expect(result).toEqual({ blog: ['draft-post'], products: [] });
    expect(blogBuilder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(blogBuilder.eq).toHaveBeenCalledWith('status', 'published');
    expect(blogBuilder.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(blogBuilder.in).toHaveBeenCalledWith('slug', [
      'live-post',
      'draft-post',
    ]);
  });

  it('returns requested product slugs that have no live active product', async () => {
    const { productBuilder } = setupSupabaseMock({
      productResult: { data: [{ slug: 'active-item' }], error: null },
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      [],
      ['active-item', 'missing-item']
    );

    expect(result).toEqual({ blog: [], products: ['missing-item'] });
    expect(productBuilder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(productBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(productBuilder.in).toHaveBeenCalledWith('slug', [
      'active-item',
      'missing-item',
    ]);
  });

  it('skips the blog query when no blog slugs were collected', async () => {
    const { from } = setupSupabaseMock({
      productResult: { data: [], error: null },
    });

    await getCachedDeadContentLinkSlugs('merchant-1', [], ['missing-item']);

    expect(from).not.toHaveBeenCalledWith('blog_posts');
    expect(from).toHaveBeenCalledWith('products');
  });

  it('skips the product query when no product slugs were collected', async () => {
    const { from } = setupSupabaseMock({
      blogResult: { data: [], error: null },
    });

    await getCachedDeadContentLinkSlugs('merchant-1', ['draft-post'], []);

    expect(from).not.toHaveBeenCalledWith('products');
    expect(from).toHaveBeenCalledWith('blog_posts');
  });

  it('treats all requested slugs as dead when none are found live', async () => {
    setupSupabaseMock({
      blogResult: { data: [], error: null },
      productResult: { data: [], error: null },
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      ['draft-post'],
      ['missing-item']
    );

    expect(result).toEqual({
      blog: ['draft-post'],
      products: ['missing-item'],
    });
  });

  it('throws when the blog query returns an error', async () => {
    setupSupabaseMock({
      blogResult: { data: null, error: new Error('blog query failed') },
    });

    await expect(
      getCachedDeadContentLinkSlugs('merchant-1', ['draft-post'], [])
    ).rejects.toThrow('blog query failed');
  });

  it('throws when the product query returns an error even if the blog query succeeds', async () => {
    setupSupabaseMock({
      blogResult: { data: [], error: null },
      productResult: { data: null, error: new Error('product query failed') },
    });

    await expect(
      getCachedDeadContentLinkSlugs(
        'merchant-1',
        ['draft-post'],
        ['missing-item']
      )
    ).rejects.toThrow('product query failed');
  });
});
