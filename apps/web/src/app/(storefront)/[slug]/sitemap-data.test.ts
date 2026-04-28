import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

let mockHeaders = new Map<string, string>();
const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockBuildCategorySupportLinks = vi.fn();
const mockQueryResults = new Map<
  string,
  { data: unknown; error: Error | null }
>();
const mockSelectCalls: string[] = [];

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
}));

vi.mock('@/lib/storefront-compare/build-commercial-support-links', () => ({
  buildCategorySupportLinks: (...args: unknown[]) =>
    mockBuildCategorySupportLinks(...args),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-')),
  getProductUrl: vi.fn(
    (product: {
      id: string;
      slug?: string | null;
      category_slug?: string | null;
      categories?: { slug?: string | null } | null;
      canonical_url?: string | null;
    }) => {
      if (product.canonical_url) {
        try {
          return new URL(product.canonical_url, 'https://storefront.invalid')
            .pathname;
        } catch {
          // fall through to slug/category-based path
        }
      }

      const slug = product.slug || product.id;
      const categorySlug = product.categories?.slug || product.category_slug;
      return categorySlug ? `/${categorySlug}/${slug}` : `/products/${slug}`;
    }
  ),
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
      if (table === 'products') {
        const rows = Array.isArray(response?.data)
          ? (response?.data as unknown[])
          : [];

        return {
          data: rows,
          error: response?.error ?? null,
          order: () => ({
            range: (from: number, to: number) => ({
              data: rows.slice(from, to + 1),
              error: response?.error ?? null,
            }),
          }),
          range: (from: number, to: number) => ({
            data: rows.slice(from, to + 1),
            error: response?.error ?? null,
          }),
        };
      }

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
      select: (columns?: string) => {
        if (columns) {
          mockSelectCalls.push(columns);
        }

        return {
          eq: createEq(table),
        };
      },
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
    mockSelectCalls.length = 0;
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedCategoryPageData.mockResolvedValue(null);
    mockGetCachedFeatureSettings.mockReset();
    // Default to blog enabled; individual tests can override.
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
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
        category_slug: null,
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

  it('paginates product sitemap queries beyond the Supabase 1000 row default', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });

    mockProductsQuery(
      Array.from({ length: 1002 }, (_, index) => ({
        id: `p${index + 1}`,
        slug: `product-${index + 1}`,
        category: 'Smartphones',
        images: [],
        updated_at: '2026-01-15T00:00:00Z',
        category_id: 'cat-1',
        category_slug: null,
        categories: { slug: 'smartphones' },
      }))
    );

    const { resolveStorefrontSitemapContext, getProductSitemapEntries } =
      await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );

    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const entries = await getProductSitemapEntries(context);

    expect(entries).toHaveLength(1002);
    expect(entries[1001]?.url).toBe(
      'https://ogabassey.com/smartphones/product-1002'
    );
  });

  it('falls back to /products path when category slug is missing', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockProductsQuery([
      {
        id: 'p2',
        slug: 'macbook-pro-m4-max-36gb-1tb-16-inch',
        category: 'Laptops',
        images: [],
        updated_at: '2026-01-16T00:00:00Z',
        category_id: null,
        category_slug: null,
        categories: null,
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
      url: 'https://ogabassey.com/products/macbook-pro-m4-max-36gb-1tb-16-inch',
    });
  });

  it('does not select missing products.category_slug directly', async () => {
    mockProductsQuery([]);
    const { getProductSitemapEntries } = await import('./sitemap-data');

    await getProductSitemapEntries({
      merchant: { id: 'merchant-1', slug: 'ogabassey' },
      storeUrl: 'https://ogabassey.com',
      supabase: {
        from: (table: string) => ({
          select: (columns: string) => {
            mockSelectCalls.push(columns);
            return { eq: createEq(table) };
          },
        }),
      },
    } as unknown as Parameters<typeof getProductSitemapEntries>[0]);

    expect(mockSelectCalls.join('\n')).not.toMatch(/\bcategory_slug\b/);
  });

  it('keeps root sitemap available when product sitemap generation fails', async () => {
    const { getRootSitemapEntries } = await import('./sitemap-data');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      return undefined;
    });

    try {
      const entries = await getRootSitemapEntries({
        merchant: {
          id: 'merchant-1',
          slug: 'ogabassey',
          business_name: 'Ogabassey',
        },
        storeUrl: 'https://ogabassey.com',
        supabase: {
          from: () => {
            throw new Error('catalog source unavailable');
          },
        },
      } as unknown as Parameters<typeof getRootSitemapEntries>[0]);

      expect(
        entries.some((entry) => entry.url === 'https://ogabassey.com')
      ).toBe(true);
      expect(
        entries.some((entry) => entry.url === 'https://ogabassey.com/faq')
      ).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('includes blog entries in both root and dedicated blog sitemaps for full discoverability', async () => {
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
        category_slug: null,
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
      getBlogSitemapEntries,
    } = await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );
    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const rootEntries = await getRootSitemapEntries(context);
    const blogEntries = await getBlogSitemapEntries(context);
    const categoryEntries = await getNamedSitemapEntries(context, 'categories');

    // Blog post URL must appear in the root sitemap so crawlers that only
    // discover /sitemap.xml (e.g. platform domain path-mode storefronts)
    // can still reach blog content.
    expect(
      rootEntries.some(
        (entry) =>
          entry.url === 'https://ogabassey.com/blog/best-phones-in-nigeria'
      )
    ).toBe(true);
    expect(
      blogEntries.some(
        (entry) =>
          entry.url === 'https://ogabassey.com/blog/best-phones-in-nigeria'
      )
    ).toBe(true);
    expect(categoryEntries[0].url).toBe('https://ogabassey.com/smartphones');
  });

  it('omits blog URLs from the sitemap when blog_enabled is false', async () => {
    setCustomDomainHeader('ogabassey.com');
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });
    mockBlogPostsQuery([
      {
        slug: 'hidden-post',
        published_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-03T00:00:00Z',
        featured_image_url: null,
      },
    ]);

    const {
      resolveStorefrontSitemapContext,
      getBlogSitemapEntries,
      getRootSitemapEntries,
    } = await import('./sitemap-data');
    const context = await resolveStorefrontSitemapContext(
      mockHeaders as unknown as Headers
    );
    if (!context) {
      throw new Error('Expected storefront sitemap context');
    }

    const blogEntries = await getBlogSitemapEntries(context);

    // When the blog feature is disabled, NO blog URLs (not even the /blog
    // index) should be surfaced — they all 404 on the storefront.
    expect(blogEntries).toEqual([]);

    // The root sitemap must also exclude every /blog URL so crawlers don't
    // discover blog routes that will 404 under the flag.
    const rootEntries = await getRootSitemapEntries(context);
    expect(rootEntries.every((entry) => !entry.url.includes('/blog'))).toBe(
      true
    );
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
