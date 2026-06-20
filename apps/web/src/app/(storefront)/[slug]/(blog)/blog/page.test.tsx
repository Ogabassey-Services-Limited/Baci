import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedBlogListing } from '@/lib/cached-data';

const { mockDefaultBlogUi } = vi.hoisted(() => ({
  mockDefaultBlogUi: vi.fn((props: MockDefaultBlogUiProps) => (
    <div>{props.merchant.business_name} blog</div>
  )),
}));

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

const mockBuildBlogClusterCollections = vi.fn();

interface MockDefaultBlogUiProps {
  blogSchema: {
    blogPost?: unknown;
  };
  itemListSchema?: {
    '@type'?: string;
    itemListElement?: Array<{
      '@type'?: string;
      position?: number;
      url?: string;
      name?: string;
    }>;
  };
  categories: string[];
  merchant: { business_name: string };
  posts: Array<{ slug: string; title: string }>;
  totalPosts: number;
}

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
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

const { default: BlogPage, generateMetadata } = await import('./page');
const { BlogPageContent } = await import('./blog-page-content');

describe('blog page metadata', () => {
  beforeEach(() => {
    vi.mocked(getCachedBlogListing).mockReset();
    vi.mocked(getCachedBlogListing).mockResolvedValue(buildListingResult());
    mockNotFound.mockClear();
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

  it('keeps metadata on the canonical blog listing regardless of pagination', async () => {
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

    expect(metadata.alternates?.canonical).toBe('https://example.com/blog');
    expect(metadata.openGraph?.url).toBe('https://example.com/blog');
    expect(getCachedBlogListing).toHaveBeenCalledWith('example.com', {
      page: 1,
    });
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

  it('throws not found when the listing data is missing at render time', async () => {
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(null);

    await expect(
      BlogPageContent({
        params: Promise.resolve({ slug: 'missing-store' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledOnce();
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

  it('renders crawlable blog links in the route HTML instead of a Suspense shell', async () => {
    mockDefaultBlogUi.mockImplementation((props: MockDefaultBlogUiProps) => (
      <section>
        <h1>{props.merchant.business_name} blog</h1>
        {props.posts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`}>
            {post.title}
          </a>
        ))}
      </section>
    ));

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.queryByRole('status', { name: /loading blog posts/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'First Post' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining('/blog/first-post'),
        }),
      ])
    );
  });

  it('renders guide collections after the blog listing', async () => {
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
    const blogListing = screen.getByText('Ogabassey blog');
    const guideCollections = screen.getByRole('heading', {
      name: /guide collections/i,
    });
    const discoveryLinks = screen.getByRole('heading', {
      name: /continue exploring/i,
    });
    expect(
      blogListing.compareDocumentPosition(guideCollections) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      guideCollections.compareDocumentPosition(discoveryLinks) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

  it('passes an ItemList schema for crawlable blog listing entities', async () => {
    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchema: expect.objectContaining({
          '@type': 'ItemList',
          name: 'Ogabassey Blog articles',
          numberOfItems: 1,
          url: 'https://test-store.usebaci.com/blog',
          itemListElement: [
            expect.objectContaining({
              '@type': 'ListItem',
              position: 1,
              url: 'https://test-store.usebaci.com/blog/first-post',
              name: 'First Post',
            }),
          ],
        }),
      })
    );
  });

  it('omits ItemList schema when the blog listing has no posts', async () => {
    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(
      buildListingResult({
        posts: [],
        totalPosts: 0,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchema: undefined,
      })
    );
  });

  it('keeps ItemList count aligned with the emitted top-ten entries', async () => {
    const posts = Array.from({ length: 15 }, (_, index) => ({
      ...postsPayload[0],
      id: `post-${index + 1}`,
      title: `Post ${index + 1}`,
      slug: `post-${index + 1}`,
    }));

    vi.mocked(getCachedBlogListing).mockResolvedValueOnce(
      buildListingResult({
        posts,
        totalPosts: posts.length,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    const itemListSchema = mockDefaultBlogUi.mock.calls[0]?.[0].itemListSchema;

    expect(itemListSchema).toEqual(
      expect.objectContaining({
        numberOfItems: 10,
        itemListElement: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            name: 'Post 1',
          }),
          expect.objectContaining({
            position: 10,
            name: 'Post 10',
          }),
        ]),
      })
    );
    expect(itemListSchema?.itemListElement).toHaveLength(10);
  });
});
