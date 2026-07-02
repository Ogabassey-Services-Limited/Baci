import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  resetBlogPageContentMocks,
} from './blog-page-content.test-utils';

const { buildBlogListingMetadata } = await import('./blog-listing-metadata');

describe('blog listing metadata builder', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
  });

  it('keeps the base blog listing indexable and canonical', async () => {
    const metadata = await buildBlogListingMetadata({
      slug: 'ogabassey.com',
      searchParams: {},
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/blog'
    );
  });

  it('keeps known query category filters noindex and canonicalizes to the clean hub', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
      }),
      categories: ['Smartphones', 'Laptops'],
    });

    const metadata = await buildBlogListingMetadata({
      slug: 'ogabassey.com',
      searchParams: { category: 'Smartphones' },
    });

    expect(metadata.title).toEqual({
      absolute: 'Smartphones Articles | Ogabassey',
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
    expect(metadata.openGraph?.url).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
  });

  it('keeps unknown query category filters noindex and canonicalizes to /blog', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
      }),
      categories: ['Smartphones'],
    });

    const metadata = await buildBlogListingMetadata({
      slug: 'ogabassey.com',
      searchParams: { category: 'Unknown' },
    });

    expect(metadata.title).toEqual({
      absolute: 'Unknown Articles | Ogabassey',
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe('https://ogabassey.com/blog');
  });

  it('allows the clean category hub to be indexable', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
      }),
      categories: ['Smartphones'],
    });

    const metadata = await buildBlogListingMetadata({
      slug: 'ogabassey.com',
      searchParams: { category: 'Smartphones' },
      canonicalUrl: 'https://ogabassey.com/blog/category/smartphones',
      indexable: true,
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
  });

  it('uses a page-scoped canonical for paginated category listings', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
        totalPosts: 50,
      }),
      totalPages: 5,
      categories: ['Smartphones'],
    });

    const metadata = await buildBlogListingMetadata({
      slug: 'ogabassey.com',
      searchParams: { category: 'Smartphones', page: '2' },
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog?category=Smartphones&page=2'
    );
  });

  it('returns noindex fallback metadata when listing data is missing', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(null);

    const metadata = await buildBlogListingMetadata({
      slug: 'missing-store',
      searchParams: {},
    });

    expect(metadata).toEqual({
      title: 'Blog Not Found',
      robots: { index: false, follow: false },
    });
  });
});
