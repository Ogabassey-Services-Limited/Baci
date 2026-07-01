import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCachedBlogListing,
  mockGetCachedBlogAuthor,
  mockGetBlogAuthorBySlug,
} = vi.hoisted(() => ({
  mockGetCachedBlogListing: vi.fn(),
  mockGetCachedBlogAuthor: vi.fn(),
  mockGetBlogAuthorBySlug: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogListing: (...args: unknown[]) =>
    mockGetCachedBlogListing(...args),
  getCachedBlogAuthor: (...args: unknown[]) => mockGetCachedBlogAuthor(...args),
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
    mockGetCachedBlogListing.mockResolvedValue(listing());
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

  it('leaves in-range listing pagination alone', async () => {
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 2,
    });
    expect(result.redirectPath).toBeNull();
  });

  it('clamps out-of-range clean-category pagination', async () => {
    mockGetCachedBlogListing.mockResolvedValue(listing({ totalPages: 2 }));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'category-page',
      categorySlug: 'smartphones',
      page: 99,
    });
    expect(result.redirectPath).toBe('/blog/category/smartphones?page=2');
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

  it('fails open when a data lookup throws', async () => {
    mockGetCachedBlogListing.mockRejectedValue(new Error('db down'));
    const result = await getCachedStorefrontBlogListingStatus('ogabassey.com', {
      kind: 'listing-page',
      page: 99,
    });
    expect(result).toEqual({
      hasError: true,
      redirectPath: null,
      permanent: false,
      notFound: false,
    });
  });

  it('fails open for an empty identifier', async () => {
    const result = await getCachedStorefrontBlogListingStatus('   ', {
      kind: 'category-query',
      category: 'Smartphones',
    });
    expect(result.hasError).toBe(true);
  });
});
