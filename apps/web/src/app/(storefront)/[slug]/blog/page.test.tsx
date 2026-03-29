import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedFeatureSettings,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getPublicSupabaseClient,
} from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: vi.fn(),
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
  getPublicSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  slug: 'test-store',
  custom_domain: null,
  logo_url: '',
  template_id: 'ogabassey',
};

const postsPayload = [
  {
    id: 'post-1',
    title: 'First Post',
    slug: 'first-post',
    excerpt: 'Latest store updates',
    featured_image_url: 'https://cdn.example.com/blog-cover.png',
    featured_image_alt: 'First Post cover',
    category: 'News',
    tags: ['launch'],
    author_name: 'Ogabassey',
    published_at: '2026-03-28T10:00:00.000Z',
    reading_time_minutes: 4,
    view_count: 10,
  },
];

function buildSupabaseClient(posts = postsPayload) {
  const postsQuery = {
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  postsQuery.eq.mockReturnValue(postsQuery);
  postsQuery.order.mockReturnValue(postsQuery);
  postsQuery.range.mockResolvedValue({
    data: posts,
    count: posts.length,
    error: null,
  });

  const categoriesQuery = {
    eq: vi.fn(),
    not: vi.fn(),
  };
  categoriesQuery.eq.mockReturnValue(categoriesQuery);
  categoriesQuery.not.mockResolvedValue({
    data: [{ category: 'News' }],
    error: null,
  });

  const select = vi
    .fn()
    .mockImplementationOnce(() => postsQuery)
    .mockImplementationOnce(() => categoriesQuery);

  return {
    from: vi.fn(() => ({
      select,
    })),
  };
}

const { generateMetadata } = await import('./page');

describe('blog page metadata', () => {
  beforeEach(() => {
    vi.mocked(getCachedFeatureSettings).mockReset();
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(getCachedMerchantByDomain).mockReset();
    vi.mocked(getPublicSupabaseClient).mockReset();

    vi.mocked(getCachedMerchant).mockResolvedValue(
      merchant as unknown as Awaited<ReturnType<typeof getCachedMerchant>>
    );
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
    } as Awaited<ReturnType<typeof getCachedFeatureSettings>>);
    vi.mocked(getPublicSupabaseClient).mockReturnValue(
      buildSupabaseClient() as unknown as ReturnType<
        typeof getPublicSupabaseClient
      >
    );
  });

  it('includes social images for the blog listing metadata', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/blog-cover.png',
        alt: 'Ogabassey blog',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/blog-cover.png',
    ]);
  });

  it('falls back to the storefront opengraph image when blog posts have no media', async () => {
    vi.mocked(getPublicSupabaseClient).mockReturnValue(
      buildSupabaseClient([
        {
          ...postsPayload[0],
          featured_image_url: '',
        },
      ]) as unknown as ReturnType<typeof getPublicSupabaseClient>
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://test-store.usebaci.com/opengraph-image',
        alt: 'Ogabassey blog',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://test-store.usebaci.com/opengraph-image',
    ]);
  });

  it('uses the merchant custom domain for paginated metadata URLs', async () => {
    vi.mocked(getCachedMerchantByDomain).mockResolvedValueOnce({
      ...merchant,
      slug: 'ogabassey',
      custom_domain: 'example.com',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchantByDomain>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'example.com' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://example.com/blog?page=2'
    );
    expect(metadata.openGraph?.url).toBe('https://example.com/blog?page=2');
  });

  it('returns fallback metadata when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: 'Blog Not Found' });
  });

  it('returns fallback metadata when the merchant blog is disabled', async () => {
    vi.mocked(getCachedFeatureSettings).mockResolvedValueOnce({
      blog_enabled: false,
    } as Awaited<ReturnType<typeof getCachedFeatureSettings>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: 'Blog Not Found' });
  });

  it('clamps invalid page params back to the first page metadata', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({ page: '0' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/blog'
    );
    expect(metadata.openGraph?.url).toBe('https://test-store.usebaci.com/blog');
  });
});
