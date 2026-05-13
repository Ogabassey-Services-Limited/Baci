import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const { mockFeedAddItem, mockFeedConstructor, mockFrom, mockUnstableCache } =
  vi.hoisted(() => ({
    mockFeedAddItem: vi.fn(),
    mockFeedConstructor: vi.fn(),
    mockFrom: vi.fn(),
    mockUnstableCache: vi.fn(),
  }));

type QueryResult<T> = { data: T; error: { message: string } | null };
type MerchantRow = {
  id: string;
  slug: string;
  business_name: string;
  site_description: string | null;
  logo_url: string | null;
  domains: Array<{
    domain: string;
    is_primary: boolean;
    status: string;
  }> | null;
};
type FeedPostRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string | null;
  category: string | null;
  author_name: string;
  published_at: string | null;
  updated_at: string | null;
};

const tableQueues = new Map<string, unknown[]>();

function enqueueTable(table: string, builder: unknown) {
  tableQueues.set(table, [...(tableQueues.get(table) ?? []), builder]);
}

function createMerchantQuery(result: QueryResult<MerchantRow | null>) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

function createDomainQuery(
  result: QueryResult<{ merchant_id: string } | null>
) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };
  return builder;
}

function createPostQuery(result: QueryResult<FeedPostRow[]>) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(result),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };
  return builder;
}

const merchant: MerchantRow = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  site_description: 'Gadgets in Nigeria',
  logo_url: null,
  domains: [],
};

const merchantWithCustomDomain: MerchantRow = {
  ...merchant,
  domains: [
    {
      domain: 'shop.example.com',
      is_primary: true,
      status: 'active',
    },
  ],
};

function enqueueSlugFeedScenario(
  options: { cachedMerchant?: MerchantRow; posts?: FeedPostRow[] } = {}
) {
  enqueueTable(
    'merchants',
    createMerchantQuery({ data: merchant, error: null })
  );
  enqueueTable(
    'merchants',
    createMerchantQuery({
      data: options.cachedMerchant ?? merchant,
      error: null,
    })
  );
  enqueueTable(
    'blog_posts',
    createPostQuery({ data: options.posts ?? [], error: null })
  );
}

function enqueueCustomDomainFeedScenario(posts: FeedPostRow[] = []) {
  enqueueTable('merchants', createMerchantQuery({ data: null, error: null }));
  enqueueTable(
    'domains',
    createDomainQuery({ data: { merchant_id: 'merchant-1' }, error: null })
  );
  enqueueTable(
    'merchants',
    createMerchantQuery({ data: merchantWithCustomDomain, error: null })
  );
  enqueueTable(
    'merchants',
    createMerchantQuery({ data: merchantWithCustomDomain, error: null })
  );
  enqueueTable('blog_posts', createPostQuery({ data: posts, error: null }));
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('feed', () => ({
  Feed: class MockFeed {
    constructor(options: unknown) {
      mockFeedConstructor(options);
    }

    addItem(item: unknown) {
      mockFeedAddItem(item);
    }

    rss2() {
      return JSON.stringify({
        options: mockFeedConstructor.mock.calls.at(-1)?.[0],
        items: mockFeedAddItem.mock.calls.map((call) => call[0]),
      });
    }
  },
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keyParts: string[], options: unknown) => {
    mockUnstableCache(fn, keyParts, options);
    return (...args: unknown[]) =>
      (fn as (...args: unknown[]) => unknown)(...args);
  },
}));

vi.mock('@/env', () => ({
  getAppUrl: () => 'https://usebaci.com',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseUrl: () => 'https://test.supabase.co',
}));

const { GET } = await import('./route');

describe('GET /api/blog/feed/[merchantSlug]', () => {
  beforeEach(() => {
    mockFeedAddItem.mockClear();
    mockFeedConstructor.mockClear();
    mockFrom.mockReset();
    tableQueues.clear();
    mockFrom.mockImplementation((table: string) => {
      const builder = tableQueues.get(table)?.shift();
      if (!builder) {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return builder;
    });
  });

  it('attaches the rss cache tag and excludes feed posts without a published_at timestamp', async () => {
    enqueueSlugFeedScenario();

    const response = await GET(new NextRequest('http://localhost/feed'), {
      params: Promise.resolve({ merchantSlug: 'ogabassey' }),
    });

    expect(response.status).toBe(200);
    const postQuery = mockFrom.mock.results[2]?.value as ReturnType<
      typeof createPostQuery
    >;
    expect(postQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(postQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockUnstableCache.mock.calls.at(-1)).toEqual([
      expect.any(Function),
      ['blog-rss-feed'],
      expect.objectContaining({
        tags: ['blog-posts', 'blog-rss-feed'],
      }),
    ]);
  });

  it('resolves custom-domain identifiers to the canonical merchant feed', async () => {
    enqueueCustomDomainFeedScenario();

    const response = await GET(
      new NextRequest('https://shop.example.com/feed'),
      {
        params: Promise.resolve({ merchantSlug: 'shop.example.com' }),
      }
    );

    expect(response.status).toBe(200);
    expect(mockFeedConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        feedLinks: {
          rss2: 'https://shop.example.com/api/blog/feed/ogabassey',
        },
      })
    );
  });

  it('builds path-mode feed URLs from the storefront origin root', async () => {
    enqueueSlugFeedScenario();

    const response = await GET(new NextRequest('https://usebaci.com/feed'), {
      params: Promise.resolve({ merchantSlug: 'ogabassey' }),
    });

    expect(response.status).toBe(200);
    expect(mockFeedConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        feedLinks: {
          rss2: 'https://usebaci.com/api/blog/feed/ogabassey',
        },
      })
    );
  });

  it('omits feed updated metadata when there are no valid published post dates', async () => {
    enqueueSlugFeedScenario({ posts: [] });

    const response = await GET(new NextRequest('https://usebaci.com/feed'), {
      params: Promise.resolve({ merchantSlug: 'ogabassey' }),
    });

    expect(response.status).toBe(200);
    const lastCall = mockFeedConstructor.mock.calls.at(-1)?.[0] as
      | { updated?: Date }
      | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall).not.toEqual(
      expect.objectContaining({ updated: expect.any(Date) })
    );
    expect(Object.hasOwn(lastCall ?? {}, 'updated')).toBe(false);
  });

  it('skips malformed post dates instead of failing the feed render', async () => {
    enqueueSlugFeedScenario({
      posts: [
        {
          id: 'bad-date',
          title: 'Bad Date',
          slug: 'bad-date',
          content: '<p>Bad date</p>',
          excerpt: 'Bad date',
          featured_image_url: null,
          category: null,
          author_name: 'Ogabassey',
          published_at: 'not-a-date',
          updated_at: null,
        },
        {
          id: 'good-date',
          title: 'Good Date',
          slug: 'good-date',
          content: '<p>Good date</p>',
          excerpt: 'Good date',
          featured_image_url: null,
          category: null,
          author_name: 'Ogabassey',
          published_at: '2026-05-01T10:00:00.000Z',
          updated_at: null,
        },
      ],
    });

    const response = await GET(new NextRequest('https://usebaci.com/feed'), {
      params: Promise.resolve({ merchantSlug: 'ogabassey' }),
    });

    expect(response.status).toBe(200);
    expect(mockFeedAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Good Date' })
    );
    expect(mockFeedAddItem).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bad Date' })
    );
  });
});
