import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCachedBlogListing } = vi.hoisted(() => ({
  mockGetCachedBlogListing: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: (...args: unknown[]) =>
    mockGetCachedBlogListing(...args),
}));

vi.mock('@/lib/blog-listing-page-size', () => ({
  BLOG_LISTING_PAGE_SIZE: 12,
}));

vi.mock('../blog-category-routing', () => ({
  OGABASSEY_BLOG_STATIC_TENANTS: ['ogabassey.com', 'ogabassey'],
}));

import {
  BLOG_POST_PRERENDER_LIMIT,
  BLOG_POST_PRERENDER_PLACEHOLDER_POST_SLUG,
  BLOG_POST_PRERENDER_PLACEHOLDER_STORE_SLUG,
  resolveBlogPostStaticParams,
} from './blog-post-static-params';

function listingForPage(page: number, count: number) {
  return {
    merchant: { id: 'm1' },
    posts: Array.from({ length: count }, (_, index) => ({
      slug: `post-${page}-${index}`,
    })),
  };
}

describe('resolveBlogPostStaticParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pins the prerender limit to a whole number of listing pages', () => {
    expect(BLOG_POST_PRERENDER_LIMIT).toBe(48);
    expect(BLOG_POST_PRERENDER_LIMIT % 12).toBe(0);
  });

  it('emits { slug, postSlug } pairs for each static tenant', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listingForPage(1, 3));

    const params = await resolveBlogPostStaticParams();

    // Page 1 short-circuits paging (3 < 12) → 3 posts per tenant, 2 tenants.
    expect(params).toEqual([
      { slug: 'ogabassey.com', postSlug: 'post-1-0' },
      { slug: 'ogabassey.com', postSlug: 'post-1-1' },
      { slug: 'ogabassey.com', postSlug: 'post-1-2' },
      { slug: 'ogabassey', postSlug: 'post-1-0' },
      { slug: 'ogabassey', postSlug: 'post-1-1' },
      { slug: 'ogabassey', postSlug: 'post-1-2' },
    ]);
    // One fetch per tenant since page 1 was not full.
    expect(mockGetCachedBlogListing).toHaveBeenCalledTimes(2);
  });

  it('caps each tenant at the prerender limit and stops paging there', async () => {
    mockGetCachedBlogListing.mockImplementation(
      async (_tenant: string, options: { page: number }) =>
        listingForPage(options.page, 12)
    );

    const params = await resolveBlogPostStaticParams();

    // 48 posts per tenant × 2 tenants, never fetching a 5th page.
    expect(params).toHaveLength(BLOG_POST_PRERENDER_LIMIT * 2);
    expect(mockGetCachedBlogListing).toHaveBeenCalledTimes(8);
    const requestedPages = mockGetCachedBlogListing.mock.calls.map(
      (call) => (call[1] as { page: number }).page
    );
    expect(Math.max(...requestedPages)).toBe(4);
  });

  it('falls back to a single placeholder param when no posts exist', async () => {
    mockGetCachedBlogListing.mockResolvedValue(null);

    const params = await resolveBlogPostStaticParams();

    expect(params).toEqual([
      {
        slug: BLOG_POST_PRERENDER_PLACEHOLDER_STORE_SLUG,
        postSlug: BLOG_POST_PRERENDER_PLACEHOLDER_POST_SLUG,
      },
    ]);
  });

  it('falls back to the placeholder when every listing lookup rejects', async () => {
    mockGetCachedBlogListing.mockRejectedValue(new Error('build-time outage'));

    const params = await resolveBlogPostStaticParams();

    expect(params).toEqual([
      {
        slug: BLOG_POST_PRERENDER_PLACEHOLDER_STORE_SLUG,
        postSlug: BLOG_POST_PRERENDER_PLACEHOLDER_POST_SLUG,
      },
    ]);
  });
});
