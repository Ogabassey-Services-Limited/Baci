import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBlogAuthorPageContent,
  mockGetBlogAuthorBySlug,
  mockGetCachedBlogAuthor,
} = vi.hoisted(() => ({
  mockBlogAuthorPageContent: vi.fn((_props: unknown) => <div>Author page</div>),
  mockGetBlogAuthorBySlug: vi.fn(),
  mockGetCachedBlogAuthor: vi.fn(),
}));

vi.mock('@/lib/blog-authors', () => ({
  getBlogAuthorBySlug: (...args: unknown[]) => mockGetBlogAuthorBySlug(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogAuthor: (...args: unknown[]) => mockGetCachedBlogAuthor(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { custom_domain?: string; slug: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('./blog-author-page-content', () => ({
  BlogAuthorPageContent: (props: unknown) => mockBlogAuthorPageContent(props),
}));

const { default: BlogAuthorPage, generateMetadata } = await import('./page');

describe('blog author page metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: ['https://www.linkedin.com/in/bassey-john-6a277885'],
    });
    mockGetCachedBlogAuthor.mockResolvedValue({
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      author: {
        name: 'Bassey John',
        title: 'Performance Marketing Specialist',
        bio: 'Bassey John writes practical device buying guides.',
        imageUrl: 'https://cdn.ogabassey.com/authors/bassey-john.jpg',
      },
    });
  });

  it('passes the tenant identifier before resolving hardcoded author profiles', async () => {
    await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        authorSlug: 'bassey-john',
      }),
    });

    expect(mockGetBlogAuthorBySlug).toHaveBeenCalledWith(
      'bassey-john',
      'ogabassey.com'
    );
  });

  it('returns profile metadata for a known author with published posts', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        authorSlug: 'bassey-john',
      }),
    });

    expect(metadata.title).toBe(
      'Bassey John — Performance Marketing Specialist at Ogabassey'
    );
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/author/bassey-john'
    );
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.ogabassey.com/authors/bassey-john.jpg',
        alt: 'Bassey John',
      },
    ]);
  });

  it('returns noindex metadata when the tenant-scoped author profile is unknown', async () => {
    mockGetBlogAuthorBySlug.mockReturnValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'another-store',
        authorSlug: 'bassey-john',
      }),
    });

    expect(metadata).toEqual({
      title: 'Author Not Found',
      robots: { index: false, follow: false },
    });
    expect(mockGetCachedBlogAuthor).not.toHaveBeenCalled();
  });

  it('delegates rendering to the author page content component', async () => {
    await BlogAuthorPage({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        authorSlug: 'bassey-john',
      }),
    });

    expect(mockBlogAuthorPageContent).toHaveBeenCalledWith({
      params: expect.any(Promise),
    });
  });
});
