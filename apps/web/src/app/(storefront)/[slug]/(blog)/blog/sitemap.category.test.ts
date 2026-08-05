import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

let mockHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeaders),
}));

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

interface BlogPostRow {
  slug: string;
  title: string;
  category: string | null;
  published_at: string;
  updated_at: string;
  featured_image_url: string | null;
}

interface BlogPostsResponse {
  data: BlogPostRow[] | null;
  error: Error | null;
}

interface EqChain {
  eq: (key: string, value: string) => EqChain | BlogPostsResponse;
  not: (
    key: string,
    operator: string,
    value: null
  ) => EqChain | BlogPostsResponse;
}

const mockEq =
  vi.fn<(key: string, value: string) => EqChain | BlogPostsResponse>();
const mockNot =
  vi.fn<(key: string, operator: string, value: null) => BlogPostsResponse>();

mockEq.mockImplementation(
  (): EqChain => ({
    eq: mockEq,
    not: mockNot,
  })
);

const mockSelect = vi.fn((): EqChain => ({ eq: mockEq, not: mockNot }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../../sitemap-data', () => ({
  resolveStorefrontSitemapContext: async (headersList: Headers) => {
    const identifier =
      headersList.get('x-custom-domain') ??
      headersList.get('host') ??
      headersList.get('x-merchant-slug') ??
      '';
    const merchant = await mockGetMerchantByIdentifier(identifier);
    if (!merchant) return null;

    const customDomain = merchant.custom_domain?.trim();
    const storeUrl =
      customDomain &&
      (headersList.get('x-custom-domain') === customDomain ||
        headersList.get('host') === customDomain)
        ? `https://${customDomain}`
        : `https://${merchant.slug}.usebaci.com`;

    return {
      merchant,
      storeUrl,
      supabase: { from: mockFrom },
    };
  },
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

let sitemap: typeof import('./sitemap').default;

describe('blog category sitemap entries', () => {
  beforeAll(async () => {
    ({ default: sitemap } = await import('./sitemap'));
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map([['x-custom-domain', 'ogabassey.com']]);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      is_published: true,
      feature_settings: { blog_enabled: true },
    });
    mockEq.mockImplementation(() => ({ eq: mockEq, not: mockNot }));
  });

  it('adds clean category hub entries for categories with enough public posts', async () => {
    mockNot.mockReturnValue({
      data: [
        {
          slug: 'smartphones-one',
          title: 'Smartphones One',
          category: 'Smartphones',
          published_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'smartphones-two',
          title: 'Smartphones Two',
          category: 'Smartphones',
          published_at: '2026-05-03T00:00:00Z',
          updated_at: '2026-05-04T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'smartphones-three',
          title: 'Smartphones Three',
          category: 'Smartphones',
          published_at: '2026-05-05T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'laptops-one',
          title: 'Laptops One',
          category: 'Laptops',
          published_at: '2026-05-07T00:00:00Z',
          updated_at: '2026-05-08T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'laptops-two',
          title: 'Laptops Two',
          category: 'Laptops',
          published_at: '2026-05-09T00:00:00Z',
          updated_at: '2026-05-10T00:00:00Z',
          featured_image_url: null,
        },
      ],
      error: null,
    });

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);
    const smartphones = result.find(
      (entry) => entry.url === 'https://ogabassey.com/blog/category/smartphones'
    );

    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('category')
    );
    expect(smartphones).toEqual(
      expect.objectContaining({
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    );
    const smartphonesLastModified = smartphones?.lastModified;
    if (!(smartphonesLastModified instanceof Date)) {
      throw new TypeError('Expected smartphones category lastModified date');
    }
    expect(smartphonesLastModified.toISOString()).toBe(
      '2026-05-06T00:00:00.000Z'
    );
    expect(urls).not.toContain('https://ogabassey.com/blog/category/laptops');
    expect(urls.some((url) => url.includes('/blog?category='))).toBe(false);
  });

  it('omits clean category hub entries for colliding category slugs', async () => {
    mockNot.mockReturnValue({
      data: [
        {
          slug: 'cases-one',
          title: 'Cases One',
          category: 'Cases & Covers',
          published_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'cases-two',
          title: 'Cases Two',
          category: 'Cases Covers',
          published_at: '2026-05-03T00:00:00Z',
          updated_at: '2026-05-04T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'cases-three',
          title: 'Cases Three',
          category: 'Cases Covers',
          published_at: '2026-05-05T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
          featured_image_url: null,
        },
      ],
      error: null,
    });

    const result = await sitemap();

    expect(result.map((entry) => entry.url)).not.toContain(
      'https://ogabassey.com/blog/category/cases-covers'
    );
  });

  it('omits clean category hub entries for unsafe category slugs', async () => {
    mockNot.mockReturnValue({
      data: [
        {
          slug: 'product-one',
          title: 'Product One',
          category: 'Product',
          published_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'product-two',
          title: 'Product Two',
          category: 'Product',
          published_at: '2026-05-03T00:00:00Z',
          updated_at: '2026-05-04T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'product-three',
          title: 'Product Three',
          category: 'Product',
          published_at: '2026-05-05T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'emoji-one',
          title: 'Emoji One',
          category: '🔥🔥',
          published_at: '2026-05-07T00:00:00Z',
          updated_at: '2026-05-08T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'emoji-two',
          title: 'Emoji Two',
          category: '🔥🔥',
          published_at: '2026-05-09T00:00:00Z',
          updated_at: '2026-05-10T00:00:00Z',
          featured_image_url: null,
        },
        {
          slug: 'emoji-three',
          title: 'Emoji Three',
          category: '🔥🔥',
          published_at: '2026-05-11T00:00:00Z',
          updated_at: '2026-05-12T00:00:00Z',
          featured_image_url: null,
        },
      ],
      error: null,
    });

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).not.toContain('https://ogabassey.com/blog/category/product');
    expect(urls).not.toContain('https://ogabassey.com/blog/category/');
    expect(urls.some((url) => url.includes('/blog?category='))).toBe(false);
  });
});
