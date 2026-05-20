import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedBlogListing } from '@/lib/cached-data';

const { mockDefaultBlogUi } = vi.hoisted(() => ({
  mockDefaultBlogUi: vi.fn((props: MockDefaultBlogUiProps) => (
    <div>{props.merchant.business_name} blog</div>
  )),
}));

const mockBuildBlogClusterCollections = vi.fn();

interface MockDefaultBlogUiProps {
  blogSchema: {
    blogPost?: unknown;
  };
  categories: string[];
  merchant: { business_name: string };
  posts: unknown[];
  totalPosts: number;
}

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: vi.fn(),
}));

vi.mock('@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker', () => ({
  StorefrontDynamicMetadataMarker: () => (
    <div aria-label="dynamic metadata marker" role="status" />
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: vi.fn(() => ({})),
  generateMetaDescription: vi.fn((description: string) => description),
  generateSlug: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
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

vi.mock('@/lib/storefront-content/build-blog-cluster-collections', () => ({
  buildBlogClusterCollections: (...args: unknown[]) =>
    mockBuildBlogClusterCollections(...args),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('./default-blog-ui', () => ({
  DefaultBlogUi: (props: MockDefaultBlogUiProps) => mockDefaultBlogUi(props),
}));

vi.mock('./template-blog-renderer', () => ({
  TemplateBlogRenderer: () => <div>Template blog</div>,
}));

const merchant: {
  id: string;
  business_name: string;
  slug: string;
  custom_domain: string | undefined;
  logo_url: string;
  template_id: string;
} = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  slug: 'test-store',
  custom_domain: undefined,
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
    featured_image_variants: {
      landscape_16x9: 'https://cdn.example.com/blog-cover-16x9.png',
      standard_4x3: 'https://cdn.example.com/blog-cover-4x3.png',
      square_1x1: 'https://cdn.example.com/blog-cover-1x1.png',
    },
    featured_image_alt: 'First Post cover',
    category: 'News',
    tags: ['launch'],
    author_name: 'Ogabassey',
    published_at: '2026-03-28T10:00:00.000Z',
    reading_time_minutes: 4,
    view_count: 10,
  },
];

const clusterCollections = [
  {
    categorySlug: 'smartphones',
    heading: 'Smartphone buying guides',
    categoryHref: 'https://ogabassey.com/smartphones',
    guides: [
      {
        href: 'https://ogabassey.com/blog/best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        description: 'Budget and flagship picks.',
        kind: 'best-in-nigeria' as const,
      },
      {
        href: 'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
        title: 'Apple vs Samsung Buying Guide',
        description: 'Which ecosystem fits you.',
        kind: 'decision-support' as const,
      },
    ],
  },
];

function buildListingResult(
  overrides?: Partial<{
    merchant: typeof merchant;
    posts: typeof postsPayload;
    totalPosts: number;
  }>
) {
  const posts = overrides?.posts ?? postsPayload;
  return {
    merchant: overrides?.merchant ?? merchant,
    posts,
    totalPosts: overrides?.totalPosts ?? posts.length,
    categories: ['News', 'gcrblw'],
    currentPage: 1,
    totalPages: 1,
    searchQuery: undefined,
  };
}

const {
  BlogPageContent,
  default: BlogPage,
  generateMetadata,
} = await import('./page');

describe('blog page metadata', () => {
  beforeEach(() => {
    vi.mocked(getCachedBlogListing).mockReset();
    vi.mocked(getCachedBlogListing).mockResolvedValue(buildListingResult());
    mockBuildBlogClusterCollections.mockReset();
    mockBuildBlogClusterCollections.mockReturnValue([]);
    mockDefaultBlogUi.mockReset();
    mockDefaultBlogUi.mockImplementation((props: MockDefaultBlogUiProps) => (
      <div>{props.merchant.business_name} blog</div>
    ));
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
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(
      buildListingResult({
        posts: [{ ...postsPayload[0], featured_image_url: '' }],
      })
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
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          slug: 'ogabassey',
          custom_domain: 'example.com',
        },
      })
    );

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
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({ title: 'Blog Not Found' });
  });

  it('returns fallback metadata when the merchant blog is disabled', async () => {
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(null);

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

  it('shows the blog listing fallback while runtime metadata and listing UI are pending', () => {
    const pending = new Promise(() => {
      // Keep request-time metadata and listing UI suspended behind their boundaries.
    });
    mockDefaultBlogUi.mockImplementation(() => {
      throw pending;
    });

    render(
      <BlogPage
        params={Promise.resolve({ slug: 'test-store' })}
        searchParams={Promise.resolve({})}
      />
    );

    expect(
      screen.getByRole('status', { name: /loading blog posts/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /dynamic metadata marker/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Ogabassey blog')).not.toBeInTheDocument();
  });

  it('renders guide collections above the blog listing', async () => {
    mockBuildBlogClusterCollections.mockReturnValue(clusterCollections);

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('heading', { name: /guide collections/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' })
    ).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog/best-phones-in-nigeria'
    );
  });

  it('uses structured image variants and preserves listing pagination totals', async () => {
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(
      buildListingResult({
        totalPosts: 50,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['News'],
        posts: [postsPayload[0]],
        totalPosts: 50,
      })
    );
    expect(mockDefaultBlogUi.mock.calls[0]?.[0].blogSchema.blogPost).toEqual([
      expect.objectContaining({
        image: [
          'https://cdn.example.com/blog-cover-16x9.png',
          'https://cdn.example.com/blog-cover-4x3.png',
          'https://cdn.example.com/blog-cover-1x1.png',
        ],
      }),
    ]);
  });
});
