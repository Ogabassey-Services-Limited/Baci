import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockGetMerchantStrict = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => mockCacheLife(...args),
  cacheTag: (...args: unknown[]) => mockCacheTag(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getMerchantStrict: (...args: unknown[]) => mockGetMerchantStrict(...args),
  getPublicSupabaseClient: (...args: unknown[]) =>
    mockGetPublicSupabaseClient(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { custom_domain?: string | null; slug: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

const { resolveBlogCategoryHub } = await import('./blog-category-hub');

function createCategoryQuery(result: {
  data: Array<{ category: string | null }>;
  error: unknown;
}) {
  const query = {
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    not: vi.fn(() => query),
    select: vi.fn(() => query),
  };

  Object.defineProperty(query, 'then', {
    value: (
      resolve: (value: typeof result) => void,
      reject?: (reason: unknown) => void
    ) => Promise.resolve(result).then(resolve, reject),
  });

  return query;
}

describe('resolveBlogCategoryHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantStrict.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
  });

  it('resolves a public category slug to its label and clean canonical URL', async () => {
    const query = createCategoryQuery({
      data: [{ category: 'Smartphones' }, { category: 'Laptops' }],
      error: null,
    });
    const from = vi.fn(() => ({ select: query.select }));
    mockGetPublicSupabaseClient.mockReturnValue({ from });

    const hub = await resolveBlogCategoryHub('OGABASSEY.COM', 'smartphones');

    expect(hub).toEqual({
      canonicalUrl: 'https://ogabassey.com/blog/category/smartphones',
      categoryLabel: 'Smartphones',
    });
    expect(mockGetMerchantStrict).toHaveBeenCalledWith('ogabassey.com');
    expect(mockCacheTag).toHaveBeenCalledWith(
      'blog-posts',
      'blog-category-hub-ogabassey.com'
    );
    expect(from).toHaveBeenCalledWith('blog_posts');
    expect(query.select).toHaveBeenCalledWith('category');
  });

  it('returns null when the blog feature is disabled', async () => {
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'smartphones')
    ).resolves.toBeNull();
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns null for unknown category slugs', async () => {
    const query = createCategoryQuery({
      data: [{ category: 'Smartphones' }],
      error: null,
    });
    mockGetPublicSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ select: query.select })),
    });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'tablets')
    ).resolves.toBeNull();
  });

  it('returns null when category lookup fails', async () => {
    const query = createCategoryQuery({
      data: [],
      error: { message: 'timeout' },
    });
    mockGetPublicSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ select: query.select })),
    });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'smartphones')
    ).resolves.toBeNull();
  });
});
