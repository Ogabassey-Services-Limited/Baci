import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  postsPayload,
  resetBlogPageContentMocks,
} from './blog-page-content.test-utils';

const { generateMetadata } = await import('./page');

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
    expect(metadata.other).toBeUndefined();
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('example.com', {
      page: 2,
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

    expect(metadata).toEqual({ title: 'Blog Not Found' });
  });

  it('returns fallback metadata when the merchant blog is disabled', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(null);

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
