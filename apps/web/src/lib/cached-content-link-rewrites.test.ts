import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateAdminClient,
  mockGetCachedProductCanonicalPaths,
  mockGetPublicSupabaseClient,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockGetCachedProductCanonicalPaths: vi.fn(),
  mockGetPublicSupabaseClient: vi.fn(),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://example.supabase.co',
  getSupabaseServiceRoleKey: () => 'service-role-key',
}));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: mockGetPublicSupabaseClient,
}));
vi.mock('@/lib/cached-product-canonical-paths', () => ({
  getCachedProductCanonicalPaths: (...args: unknown[]) =>
    mockGetCachedProductCanonicalPaths(...args),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { getCachedContentLinkRewrites } from '@/lib/cached-content-link-rewrites';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['eq', 'in', 'not']) {
    builder[method] = vi.fn(() => builder);
  }
  Object.defineProperty(builder, 'then', {
    value: (
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void
    ) => Promise.resolve(result).then(resolve, reject),
  });
  return builder;
}

function setupClients({
  redirectRows = [],
  targetRows = [],
  archivedRows = [],
  archivedRowsById = [],
  activeUuidRows = [],
}: {
  redirectRows?: unknown[];
  targetRows?: unknown[];
  archivedRows?: unknown[];
  archivedRowsById?: unknown[];
  activeUuidRows?: unknown[];
} = {}) {
  let blogQueryCount = 0;
  mockGetPublicSupabaseClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'blog_post_redirects') {
        return {
          select: vi.fn(() =>
            createQueryBuilder({ data: redirectRows, error: null })
          ),
        };
      }
      if (table === 'blog_posts') {
        blogQueryCount += 1;
        return {
          select: vi.fn(() =>
            createQueryBuilder({ data: targetRows, error: null })
          ),
        };
      }
      if (table === 'products') {
        // Active-by-id lookup for UUID-shaped candidates (anon-visible rows).
        return {
          select: vi.fn(() =>
            createQueryBuilder({ data: activeUuidRows, error: null })
          ),
        };
      }
      throw new Error(`Unexpected public table: ${table}`);
    }),
  });
  // The archived-parent resolver issues up to two products queries per call
  // (by slug and/or by id for UUID candidates); resolve rows lazily based on
  // which column the query filtered with so skipped queries don't shift data.
  mockCreateAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== 'products') {
        throw new Error(`Unexpected service table: ${table}`);
      }
      let inColumn = '';
      const builder: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const method of ['eq', 'not']) {
        builder[method] = vi.fn(() => builder);
      }
      builder.in = vi.fn((column: string) => {
        inColumn = column;
        return builder;
      });
      Object.defineProperty(builder, 'then', {
        value: (
          resolve: (value: QueryResult) => void,
          reject?: (reason: unknown) => void
        ) =>
          Promise.resolve({
            data: inColumn === 'id' ? archivedRowsById : archivedRows,
            error: null,
          }).then(resolve, reject),
      });
      return { select: vi.fn(() => builder) };
    }),
  });
  return { getBlogQueryCount: () => blogQueryCount };
}

describe('getCachedContentLinkRewrites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedProductCanonicalPaths.mockResolvedValue({});
  });

  it('returns empty rewrites without querying when no slugs are collected', async () => {
    setupClients();

    const rewrites = await getCachedContentLinkRewrites('merchant-1', [], []);

    expect(rewrites).toEqual({ blogSlugs: {}, productPaths: {} });
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns canonical paths for live products', async () => {
    setupClients();
    mockGetCachedProductCanonicalPaths.mockResolvedValueOnce({
      'apple-airpods-2': '/earbuds/apple-airpods-2',
    });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      [],
      ['apple-airpods-2']
    );

    expect(rewrites.productPaths['apple-airpods-2']).toBe(
      '/earbuds/apple-airpods-2'
    );
  });

  it('maps archived variant slugs to their active parent canonical path', async () => {
    setupClients({
      archivedRows: [
        {
          slug: 'iphone-13-pro-6gb-256gb',
          parent: { slug: 'iphone-13-pro', status: 'active' },
        },
      ],
    });
    // First call: collected slugs (no live rows). Second call: parent slugs.
    mockGetCachedProductCanonicalPaths
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        'iphone-13-pro': '/smartphones/iphone-13-pro',
      });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      [],
      ['iphone-13-pro-6gb-256gb']
    );

    expect(rewrites.productPaths['iphone-13-pro-6gb-256gb']).toBe(
      '/smartphones/iphone-13-pro'
    );
  });

  it('ignores archived slugs whose parent is not active', async () => {
    setupClients({
      archivedRows: [
        {
          slug: 'old-variant',
          parent: { slug: 'also-archived', status: 'archived' },
        },
      ],
    });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      [],
      ['old-variant']
    );

    expect(rewrites.productPaths).toEqual({});
  });

  it('maps renamed blog slugs to their published target slug', async () => {
    setupClients({
      redirectRows: [
        { source_slug: 'buying-a-used-iphone-in-2025', target_post_id: 'p1' },
      ],
      targetRows: [
        {
          id: 'p1',
          slug: 'the-ultimate-checklist-for-buying-a-used-iphone',
          title: 'The ultimate checklist for buying a used iPhone',
        },
      ],
    });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      ['buying-a-used-iphone-in-2025'],
      []
    );

    expect(rewrites.blogSlugs['buying-a-used-iphone-in-2025']).toBe(
      'the-ultimate-checklist-for-buying-a-used-iphone'
    );
  });

  it('omits blog rewrites whose redirect target is not published', async () => {
    setupClients({
      redirectRows: [{ source_slug: 'renamed-post', target_post_id: 'p2' }],
      targetRows: [],
    });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      ['renamed-post'],
      []
    );

    expect(rewrites.blogSlugs).toEqual({});
  });

  it('omits blog rewrites whose redirect target is suppressed by the public blog filters', async () => {
    setupClients({
      redirectRows: [{ source_slug: 'renamed-post', target_post_id: 'p3' }],
      // Published, but the title-prefix suppression means the public blog
      // route will never serve it — so it must not count as a rewrite.
      targetRows: [
        { id: 'p3', slug: 'test-post-target', title: 'Test post target' },
      ],
    });

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      ['renamed-post'],
      []
    );

    expect(rewrites.blogSlugs).toEqual({});
  });

  it('rewrites active UUID product links to the canonical slug path', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    setupClients({
      activeUuidRows: [{ id: uuid.toUpperCase(), slug: 'iphone-15' }],
    });
    mockGetCachedProductCanonicalPaths.mockImplementation(
      async (_merchantId: unknown, slugs: unknown) =>
        Array.isArray(slugs) && slugs.includes('iphone-15')
          ? { 'iphone-15': '/smartphones/iphone-15' }
          : {}
    );

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      [],
      [uuid]
    );

    expect(rewrites.productPaths[uuid]).toBe('/smartphones/iphone-15');
  });

  it('maps archived UUID product links to the active parent canonical path', async () => {
    const uuid = '223e4567-e89b-12d3-a456-426614174000';
    setupClients({
      archivedRowsById: [
        {
          id: uuid,
          slug: 'old-variant-slug',
          parent: { slug: 'parent-product', status: 'active' },
        },
      ],
    });
    mockGetCachedProductCanonicalPaths.mockImplementation(
      async (_merchantId: unknown, slugs: unknown) =>
        Array.isArray(slugs) && slugs.includes('parent-product')
          ? { 'parent-product': '/smartphones/parent-product' }
          : {}
    );

    const rewrites = await getCachedContentLinkRewrites(
      'merchant-1',
      [],
      [uuid]
    );

    expect(rewrites.productPaths[uuid]).toBe('/smartphones/parent-product');
  });
});
