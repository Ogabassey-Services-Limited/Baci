import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  postsPayload,
  resetBlogPageContentMocks,
} from './blog-page-content.test-utils';

const mockBlogPageContent = vi.hoisted(() =>
  vi.fn((_props: unknown) => <div>Blog page content</div>)
);

vi.mock('./blog-page-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./blog-page-content')>();

  return {
    ...actual,
    BlogPageContent: (props: unknown) => mockBlogPageContent(props),
  };
});

const {
  default: BlogPage,
  generateMetadata,
  generateStaticParams,
} = await import('./page');

describe('blog page shell', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
    mockBlogPageContent.mockReset();
    mockBlogPageContent.mockReturnValue(<div>Blog page content</div>);
  });

  it('generates static params for the monitored OgaBassey blog listing', () => {
    expect(generateStaticParams()).toContainEqual({ slug: 'ogabassey.com' });
  });

  it('renders monitored OgaBassey listing content through the static Suspense shell', async () => {
    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('Blog page content')).toBeInTheDocument();
  });

  it('does not subscribe to listing search params before rendering the Suspense shell', async () => {
    const searchParams = new Promise<Record<string, never>>(() => {
      // Intentionally unresolved; the route shell must pass it through without
      // attaching a then handler outside the Suspense boundary.
    });
    const thenSpy = vi.spyOn(searchParams, 'then');

    await BlogPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
      searchParams,
    });
    await Promise.resolve();

    expect(thenSpy).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('shows the blog listing fallback while monitored OgaBassey content is resolving', async () => {
    mockBlogPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves so Suspense fallback remains visible.
      });
    });

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
  });
});

describe('blog page metadata', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
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
    mockGetCachedBlogListing.mockResolvedValueOnce(
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

  it('uses a self-canonical URL for paginated blog listings', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          slug: 'ogabassey',
          custom_domain: 'example.com',
        },
        totalPosts: 50,
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
    expect(metadata.title).toBe('Blog | Page 2 | Ogabassey');
    expect(metadata.description).toContain('Page 2:');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.other).toBeUndefined();
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('example.com', {
      page: 2,
    });
  });

  it('uses distinct noindex metadata for filtered blog listings', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({ category: 'buying-guides' }),
    });

    expect(metadata.title).toBe('Buying Guides Articles | Ogabassey');
    expect(metadata.description).toContain('buying guides articles');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      category: 'buying-guides',
      page: 1,
    });
  });

  it('uses distinct noindex metadata for blog search listings', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({ search: 'iphone-reviews' }),
    });

    expect(metadata.title).toBe('Search: iphone reviews | Ogabassey');
    expect(metadata.description).toContain(
      'Search results for "iphone reviews"'
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      page: 1,
      searchQuery: 'iphone-reviews',
    });
  });

  it('uses the first repeated blog search parameter without throwing', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({ totalPosts: 50 })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({
        category: ['buying-guides', 'tablets'],
        page: ['2', '3'],
        search: ['iphone-reviews', 'ipad-reviews'],
      }),
    });

    expect(metadata.title).toBe('Search: iphone reviews | Page 2 | Ogabassey');
    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/blog?category=buying-guides&search=iphone-reviews&page=2'
    );
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      category: 'buying-guides',
      page: 2,
      searchQuery: 'iphone-reviews',
    });
  });

  it('caps long filtered metadata titles without changing the listing query', async () => {
    const longSearch =
      'iphone-reviews-for-used-flagship-smartphones-in-nigeria-under-budget';

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({ search: longSearch }),
    });

    expect(String(metadata.title).length).toBeLessThanOrEqual(70);
    expect(metadata.title).toContain('Ogabassey');
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      page: 1,
      searchQuery: longSearch,
    });
  });

  it('preserves storefront path prefixes in paginated metadata URLs', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          slug: 'ogabassey',
          store_url: 'http://localhost:3000/ogabassey',
        },
        totalPosts: 50,
      })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'http://localhost:3000/ogabassey/blog?page=2'
    );
    expect(metadata.openGraph?.url).toBe(
      'http://localhost:3000/ogabassey/blog?page=2'
    );
  });

  it('returns fallback metadata when the merchant is missing', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({
      title: 'Blog Not Found',
      robots: { index: false, follow: false },
    });
  });

  it('returns fallback metadata when the merchant blog is disabled', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({
      title: 'Blog Not Found',
      robots: { index: false, follow: false },
    });
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
