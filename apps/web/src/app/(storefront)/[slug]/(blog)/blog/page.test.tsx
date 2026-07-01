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

  it('renders the monitored OgaBassey listing content directly as crawlable static HTML', async () => {
    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
        searchParams: Promise.resolve({}),
      })
    );

    // Static tenant content lands in the initial payload (not behind the
    // loading fallback), so crawlers see article HTML without JS.
    expect(screen.getByText('Blog page content')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Loading blog posts' })
    ).not.toBeInTheDocument();
  });

  it('never resolves request search params when building the canonical shell', async () => {
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

    // The canonical shell must not consume the request-time searchParams
    // promise; doing so would opt the static shell into request-time rendering.
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

  // Route-level metadata is now request-searchParams-free so the canonical
  // shell stays static and Googlebot receives the resolved <title> instead of
  // the streamed fallback. Variant (page/category/search) metadata is still
  // exercised at the builder level in blog-listing-metadata.test.ts, where the
  // params are server-derived rather than request-bound.
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

  it('emits canonical /blog metadata regardless of request query params', async () => {
    const thenSpy = vi.fn(() => {
      throw new Error('metadata resolved request search params');
    });
    const requestSearchParams = Object.defineProperty({}, 'then', {
      value: thenSpy,
    }) as Promise<{ page?: string; search?: string; category?: string }>;

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
      searchParams: requestSearchParams,
    });

    // Query variants dedupe via the canonical link to the clean /blog URL;
    // metadata must not read request searchParams to decide that.
    expect(String(metadata.title)).toContain('Blog');
    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/blog'
    );
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('test-store', {
      page: 1,
    });
    expect(thenSpy).not.toHaveBeenCalled();
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
