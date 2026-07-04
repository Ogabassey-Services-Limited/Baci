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
  productResults = [{ data: [], error: null }],
}: {
  blogResult?: QueryResult;
  productResults?: QueryResult[];
} = {}) {
  const blogBuilder = createQueryBuilder(blogResult);
  // The loader issues up to two `products` queries per call (active-by-slug,
  // then active-by-id for UUID-shaped candidates) — hand out one builder per
  // query in order.
  const productBuilders = productResults.map(createQueryBuilder);
  let productQueryIndex = 0;

  const from = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      return { select: vi.fn(() => blogBuilder) };
    }
    if (table === 'products') {
      const builder =
        productBuilders[productQueryIndex] ??
        createQueryBuilder({ data: [], error: null });
      productQueryIndex += 1;
      return { select: vi.fn(() => builder) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  mockGetPublicSupabaseClient.mockReturnValue({ from });

  return { blogBuilder, from, productBuilders };
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
      blogResult: {
        data: [{ slug: 'live-post', title: 'A live post' }],
        error: null,
      },
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
    const { productBuilders } = setupSupabaseMock({
      productResults: [{ data: [{ slug: 'active-item' }], error: null }],
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      [],
      ['active-item', 'missing-item']
    );

    expect(result).toEqual({ blog: [], products: ['missing-item'] });
    expect(productBuilders[0].eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(productBuilders[0].eq).toHaveBeenCalledWith('status', 'active');
    expect(productBuilders[0].in).toHaveBeenCalledWith('slug', [
      'active-item',
      'missing-item',
    ]);
  });

  it('treats published posts suppressed by the public blog filters as dead', async () => {
    // The SQL-level filters exclude suppressed slugs in production; the
    // row-level isPublicBlogPost check must also hold when a row slips
    // through (e.g. title-prefix suppression).
    setupSupabaseMock({
      blogResult: {
        data: [
          { slug: 'real-guide', title: 'A real guide' },
          { slug: 'test-post-agent-integration-working', title: 'Test post' },
        ],
        error: null,
      },
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      ['real-guide', 'test-post-agent-integration-working'],
      []
    );

    expect(result).toEqual({
      blog: ['test-post-agent-integration-working'],
      products: [],
    });
  });

  it('applies the public blog suppression filters to the blog query', async () => {
    const { blogBuilder } = setupSupabaseMock({
      blogResult: { data: [], error: null },
    });

    await getCachedDeadContentLinkSlugs('merchant-1', ['draft-post'], []);

    expect(blogBuilder.not).toHaveBeenCalledWith(
      'title',
      'ilike',
      'test post%'
    );
    expect(blogBuilder.not).toHaveBeenCalledWith(
      'slug',
      'ilike',
      '%agent-integration-working%'
    );
  });

  it('treats UUID-shaped links to active products as live via the id lookup', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const { productBuilders } = setupSupabaseMock({
      productResults: [
        { data: [], error: null },
        { data: [{ id: uuid.toUpperCase() }], error: null },
      ],
    });

    const result = await getCachedDeadContentLinkSlugs(
      'merchant-1',
      [],
      [uuid, 'missing-item']
    );

    expect(result).toEqual({ blog: [], products: ['missing-item'] });
    expect(productBuilders[1].in).toHaveBeenCalledWith('id', [uuid]);
  });

  it('skips the blog query when no blog slugs were collected', async () => {
    const { from } = setupSupabaseMock({
      productResults: [{ data: [], error: null }],
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
      productResults: [{ data: [], error: null }],
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
      productResults: [
        { data: null, error: new Error('product query failed') },
      ],
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
