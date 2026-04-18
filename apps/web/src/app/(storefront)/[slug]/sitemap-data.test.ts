import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

let mockHeaders = new Map<string, string>();
const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockBuildCategorySupportLinks = vi.fn();
const mockQueryResults = new Map<
  string,
  { data: unknown; error: Error | null }
>();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
}));

vi.mock('@/lib/storefront-compare/build-commercial-support-links', () => ({
  buildCategorySupportLinks: (...args: unknown[]) =>
    mockBuildCategorySupportLinks(...args),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-')),
}));

function createEq(table: string) {
  return vi.fn((...args: unknown[]) => {
    const [key, value] = args as [string, string];
    const response = mockQueryResults.get(table);
    const isTerminalQuery =
      (table === 'products' && key === 'status' && value === 'active') ||
      (table === 'blog_posts' && key === 'status' && value === 'published') ||
      (table === 'categories' &&
        key === 'merchant_id' &&
        value === 'merchant-1');

    if (isTerminalQuery) {
      return {
        data: response?.data ?? [],
        error: response?.error ?? null,
      };
    }

    return { eq: createEq(table) };
  });
}

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: (table: string) => ({
      select: () => ({
        eq: createEq(table),
      }),
    }),
  })),
}));

function setCustomDomainHeader(domain: string) {
  mockHeaders = new Map<string, string>([['x-custom-domain', domain]]);
}

function mockProductsQuery(data: unknown, error: Error | null = null) {
  mockQueryResults.set('products', { data, error });
}

function mockCategoriesQuery(data: unknown, error: Error | null = null) {
  mockQueryResults.set('categories', { data, error });
}

function mockBlogPostsQuery(data: unknown, error: Error | null = null) {
  mockQueryResults.set('blog_posts', { data, error });
}

describe('sitemap-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockQueryResults.clear();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedCategoryPageData.mockResolvedValue(null);
    mockBuildCategorySupportLinks.mockReset();
    mockBuildCategorySupportLinks.mockReturnValue([]);
  });

  it('resolves storefront context from a custom domain header', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    const { resolveStorefrontSitemapContext } = await import('./sitemap-data');

    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(context?.storeUrl).toBe('https://ogabassey.com');
  });

  it('prefers an explicit route identifier override when resolving context', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    const { resolveStorefrontSitemapContext } = await import('./sitemap-data');

    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers,
      'ogabassey'
    );

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey');
    expect(context?.merchant.slug).toBe('ogabassey');
  });

  it('returns static sitemap entries for the storefront root and faq', async () => {
    const { getStaticSitemapEntries } = await import('./sitemap-data');
    const entries = getStaticSitemapEntries('https://ogabassey.com');

    expect(entries).toEqual([
      expect.objectContaining({ url: 'https://ogabassey.com', priority: 1 }),
      expect.objectContaining({
        url: 'https://ogabassey.com/faq',
        priority: 0.5,
      }),
    ]);
  });

  it('returns product sitemap entries with category paths and images', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockProductsQuery([
      {
        id: 'p1',
        slug: 'iphone-15',
        category: 'Smartphones',
        images: ['https://img.example.com/iphone.jpg'],
        updated_at: '2026-01-15T00:00:00Z',
        category_id: 'cat-1',
        categories: { slug: 'smartphones' },
      },
    ]);
    const { resolveStorefrontSitemapContext, getProductSitemapEntries } =
      await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );
    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const entries = await getProductSitemapEntries(context);

    expect(entries[0]).toMatchObject({
      url: 'https://ogabassey.com/smartphones/iphone-15',
      images: ['https://img.example.com/iphone.jpg'],
    });
  });

  it('returns category and blog entries and merges them into the root sitemap', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockProductsQuery([
      {
        id: 'p1',
        slug: 'iphone-15',
        category: 'Smartphones',
        images: [],
        updated_at: '2026-01-15T00:00:00Z',
        category_id: 'cat-1',
        categories: { slug: 'smartphones' },
      },
    ]);
    mockCategoriesQuery([
      { slug: 'smartphones', updated_at: '2026-01-01T00:00:00Z' },
    ]);
    mockBlogPostsQuery([
      {
        slug: 'best-phones-in-nigeria',
        published_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-03T00:00:00Z',
        featured_image_url: 'https://img.example.com/blog.jpg',
      },
    ]);
    const {
      resolveStorefrontSitemapContext,
      getRootSitemapEntries,
      getNamedSitemapEntries,
    } = await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );
    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const rootEntries = await getRootSitemapEntries(context);
    const categoryEntries = await getNamedSitemapEntries(context, 'categories');

    expect(
      rootEntries.some(
        (entry) =>
          entry.url === 'https://ogabassey.com/blog/best-phones-in-nigeria'
      )
    ).toBe(true);
    expect(categoryEntries[0].url).toBe('https://ogabassey.com/smartphones');
  });

  it('serializes sitemap XML responses with image namespace when needed', async () => {
    const { createSitemapResponse } = await import('./sitemap-data');
    const response = createSitemapResponse([
      {
        url: 'https://ogabassey.com/smartphones/iphone-15',
        lastModified: new Date('2026-01-15T00:00:00Z'),
        changeFrequency: 'weekly',
        priority: 0.8,
        images: ['https://img.example.com/iphone.jpg'],
      },
    ]);
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('xmlns:image=');
    expect(body).toContain(
      '<image:loc>https://img.example.com/iphone.jpg</image:loc>'
    );
  });

  it('publishes eligible compare pages through the public sitemap surfaces', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockCategoriesQuery([
      { slug: 'smartphones', updated_at: '2026-01-01T00:00:00Z' },
    ]);
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      fallbackName: 'Smartphones',
      products: [
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'A19 Pro',
            ram_gb: 8,
            storage_gb: 256,
          },
        },
        {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          brand: 'Samsung',
          price: 480000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Snapdragon 8 Elite',
            ram_gb: 16,
            storage_gb: 512,
          },
        },
      ],
    });
    mockBuildCategorySupportLinks.mockReturnValue([
      {
        href: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        label: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
      },
    ]);
    const {
      resolveStorefrontSitemapContext,
      getNamedSitemapEntries,
      getRootSitemapEntries,
    } = await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );

    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const namedEntries = await getNamedSitemapEntries(
      context,
      'commercial-support'
    );
    const rootEntries = await getRootSitemapEntries(context);

    expect(
      namedEntries.some((entry) =>
        entry.url.includes(
          '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
        )
      )
    ).toBe(true);
    expect(
      rootEntries.some((entry) =>
        entry.url.includes(
          '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
        )
      )
    ).toBe(true);
  });
});
