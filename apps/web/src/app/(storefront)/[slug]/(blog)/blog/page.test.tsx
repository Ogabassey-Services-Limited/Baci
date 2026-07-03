import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListingResult,
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

  it('renders the static OgaBassey listing content and forwards its request search params', async () => {
    const requestSearchParams = Promise.resolve({ search: 'iphone' });

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
        searchParams: requestSearchParams,
      })
    );

    // Static tenant content renders (behind Suspense, streamed to crawlers) and
    // keeps the request searchParams so search/pagination work on ogabassey.com.
    expect(screen.getByText('Blog page content')).toBeInTheDocument();
    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: requestSearchParams })
    );
  });

  it('builds the route shell without synchronously resolving request search params', async () => {
    const thenSpy = vi.fn(() => {
      throw new Error('search params resolved before content render');
    });
    const searchParams = Object.defineProperty({}, 'then', {
      value: thenSpy,
    }) as Promise<Record<string, never>>;

    await BlogPage({
      params: Promise.resolve({ slug: 'ogabassey.com' }),
      searchParams,
    });

    // The route shell function forwards searchParams into the Suspense boundary
    // without awaiting it, so the shell is creatable without request data (the
    // content reads it behind Suspense at request time).
    expect(thenSpy).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('shows the blog listing fallback while dynamic tenant content is resolving', async () => {
    mockBlogPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves so Suspense fallback remains visible.
      });
    });

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'dynamic-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
  });

  it('forwards request search params to non-static tenant content so pagination/search keep working', async () => {
    const requestSearchParams = Promise.resolve({ page: '2' });

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'dynamic-store' }),
        searchParams: requestSearchParams,
      })
    );

    // Non-static tenants render dynamically behind Suspense; the request
    // searchParams must reach the content so page/search/category still drive it.
    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: requestSearchParams })
    );
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

  it('builds route-specific canonical metadata for the blog listing', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).not.toBe('Ogabassey');
    expect(String(metadata.title)).toContain('Blog');
    expect(String(metadata.title)).toContain('Ogabassey');
    expect(String(metadata.description).length).toBeGreaterThan(30);
    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/blog'
    );
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  // The STATIC tenant's metadata must stay request-searchParams-free so its
  // shell prerenders and Googlebot receives the resolved <title>.
  it('does not read request search params for the static tenant metadata', async () => {
    const thenSpy = vi.fn(() => {
      throw new Error('static metadata resolved request search params');
    });
    const requestSearchParams = Object.defineProperty({}, 'then', {
      value: thenSpy,
    }) as Promise<{ page?: string; search?: string; category?: string }>;

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: requestSearchParams,
    });

    expect(String(metadata.title)).toContain('Blog');
    expect(String(metadata.alternates?.canonical)).toContain('/blog');
    expect(thenSpy).not.toHaveBeenCalled();
  });

  // Non-static tenants render dynamically, so their metadata reads searchParams
  // to keep the builder's query-specific noindex/self-canonical variants.
  it('reads request search params for non-static tenant metadata variants', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({ totalPosts: 50 })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.title).toBe('Blog | Page 2 | Ogabassey');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      page: 2,
    });
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
});
