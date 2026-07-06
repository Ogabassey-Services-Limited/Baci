import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCachedBlogListing,
  mockGetCachedBlogAuthor,
  mockGetBlogAuthorBySlug,
  mockGetMerchantStrict,
} = vi.hoisted(() => ({
  mockGetCachedBlogListing: vi.fn(),
  mockGetCachedBlogAuthor: vi.fn(),
  mockGetBlogAuthorBySlug: vi.fn(),
  mockGetMerchantStrict: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: (...args: unknown[]) =>
    mockGetCachedBlogListing(...args),
  getCachedBlogAuthor: (...args: unknown[]) => mockGetCachedBlogAuthor(...args),
  getMerchantStrict: (...args: unknown[]) => mockGetMerchantStrict(...args),
}));

vi.mock('@/lib/blog-authors', () => ({
  getBlogAuthorBySlug: (...args: unknown[]) => mockGetBlogAuthorBySlug(...args),
}));

const { getCachedStorefrontBlogListingStatus } = await import(
  './cached-storefront-blog-listing-status'
);

const CATEGORIES = ['Smartphones', 'Laptops'];

function listing(
  overrides: { categories?: string[]; totalPages?: number } = {}
) {
  return {
    merchant: { id: 'm1', slug: 'ogabassey' },
    posts: [],
    totalPosts: 0,
    categories: overrides.categories ?? CATEGORIES,
    currentPage: 1,
    totalPages: overrides.totalPages ?? 3,
    searchQuery: undefined,
  };
}

describe('getCachedStorefrontBlogListingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantStrict.mockResolvedValue({ id: 'm1', is_published: true });
    mockGetCachedBlogListing.mockResolvedValue(listing());
  });

  it('fails open (no-op) for an unpublished storefront with blog data, marked uncacheable', async () => {
    mockGetMerchantStrict.mockResolvedValue({ id: 'm1', is_published: false });
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-query',
      category: 'Smartphones',
    });
    expect(result).toEqual({
      hasError: false,
      redirectPath: null,
      permanent: false,
      notFound: false,
      // Publish-state changes never purge `blog-posts`, so the endpoint must
      // keep this NOOP out of the CDN.
      unpublishedStorefront: true,
    });
    expect(mockGetCachedBlogListing).not.toHaveBeenCalled();
  });

  it('propagates a transient merchant-lookup failure instead of returning a cacheable NOOP', async () => {
    // A thrown lookup must reach the endpoint's no-store fail-open handler —
    // returning NOOP here would let the data cache AND the route's CDN cache
    // store a fail-open verdict for the whole TTL window.
    mockGetMerchantStrict.mockRejectedValue(new Error('supabase timeout'));

    await expect(
      getCachedStorefrontBlogListingStatus('ogabassey.com', {
        kind: 'category-query',
        category: 'Smartphones',
      })
    ).rejects.toThrow('supabase timeout');
    expect(mockGetCachedBlogListing).not.toHaveBeenCalled();
  });

  it('redirects a known ?category= to the clean category route', async () => {
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-query',
      category: 'Smartphones',
    });
    expect(result).toEqual({
      hasError: false,
      redirectPath: '/blog/category/smartphones',
      permanent: true,
      notFound: false,
    });
  });

  it('leaves an unknown ?category= for the route to render', async () => {
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-query',
      category: 'Tablets',
    });
    expect(result).toEqual({
      hasError: false,
      redirectPath: null,
      permanent: false,
      notFound: false,
    });
  });

  it('does not redirect a colliding category slug (no clean target)', async () => {
    mockGetCachedBlogListing.mockResolvedValue(
      listing({ categories: ['Smart Phones', 'Smart-Phones'] })
    );
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-query',
      category: 'Smart Phones',
    });
    expect(result.redirectPath).toBeNull();
  });

  it('clamps out-of-range listing pagination to the last page', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 3 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 99,
    });
    expect(result.redirectPath).toBe('/blog?page=3');
  });

  it('clamps to page 1 (never ?page=0) when the listing is empty', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 0 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 2,
    });
    expect(result.redirectPath).toBe('/blog');
  });

  it('clamps an empty clean-category to page 1 (never ?page=0)', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 0 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-page',
      categorySlug: 'smartphones',
      page: 2,
    });
    expect(result.redirectPath).toBe('/blog?category=Smartphones');
  });

  it('leaves in-range listing pagination alone', async () => {
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 2,
    });
    expect(result.redirectPath).toBeNull();
  });

  it('clamps out-of-range clean-category pagination to the category query URL', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 2 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-page',
      categorySlug: 'smartphones',
      page: 99,
    });
    // The clean category route paginates via the query URL, not the clean hub.
    expect(result.redirectPath).toBe('/blog?category=Smartphones&page=2');
  });

  it('clamps out-of-range query-category pagination to the category query URL', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 2 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 99,
      category: 'Smartphones',
    });
    expect(result.redirectPath).toBe('/blog?category=Smartphones&page=2');
  });

  it('returns notFound for a known author with no published posts', async () => {
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: [],
    });
    mockGetCachedBlogAuthor.mockResolvedValue(null);
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'author',
      authorSlug: 'bassey-john',
      page: 1,
    });
    expect(result).toEqual({
      hasError: false,
      redirectPath: null,
      permanent: false,
      notFound: true,
    });
  });

  it('clamps out-of-range author pagination', async () => {
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: [],
    });
    mockGetCachedBlogAuthor.mockResolvedValue({ totalPages: 2 });
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'author',
      authorSlug: 'bassey-john',
      page: 99,
    });
    expect(result.redirectPath).toBe('/blog/author/bassey-john?page=2');
  });

  it('normalizes a mixed-case author slug in the clamp redirect', async () => {
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: [],
    });
    mockGetCachedBlogAuthor.mockResolvedValue({ totalPages: 2 });
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'author',
      authorSlug: 'Bassey-John',
      page: 99,
    });
    expect(result.redirectPath).toBe('/blog/author/bassey-john?page=2');
    expect(mockGetBlogAuthorBySlug).toHaveBeenCalledWith(
      'bassey-john',
      'ogabassey.com'
    );
  });

  it('leaves an unknown author for the route to resolve', async () => {
    mockGetBlogAuthorBySlug.mockReturnValue(null);
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'author',
      authorSlug: 'nobody',
      page: 1,
    });
    expect(result).toEqual({
      hasError: false,
      redirectPath: null,
      permanent: false,
      notFound: false,
    });
  });

  it('propagates data-lookup errors instead of caching a fail-open verdict', async () => {
    // The cached resolver must NOT swallow transient throws — the endpoint's
    // no-store handler fails open, so a Supabase timeout is never cached.
    mockGetCachedBlogListing.mockRejectedValue(new Error('db down'));
    await expect(
      getCachedStorefrontBlogListingStatus('ogabassey.com', {
        kind: 'listing-page',
        page: 99,
      })
    ).rejects.toThrow('db down');
  });

  it('fails open for an empty identifier', async () => {
    const result = await getCachedStorefrontBlogListingStatus('   ', {
      kind: 'category-query',
      category: 'Smartphones',
    });
    expect(result.hasError).toBe(true);
  });
});
