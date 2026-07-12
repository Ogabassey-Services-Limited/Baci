import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();
const mockGetMerchantStrict = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => mockCacheLife(...args),
  cacheTag: (...args: unknown[]) => mockCacheTag(...args),
}));

vi.mock('@/lib/cached-data', () => ({
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

function createCategoryRpc(result: {
  data: Array<{ category: string | null }>;
  error: unknown;
}) {
  return vi.fn(async () => result);
}

describe('resolveBlogCategoryHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantStrict.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
      feature_settings: { blog_enabled: true },
    });
  });

  it('resolves a public category slug to its label and clean canonical URL', async () => {
    const rpc = createCategoryRpc({
      data: [{ category: 'Smartphones' }, { category: 'Laptops' }],
      error: null,
    });
    mockGetPublicSupabaseClient.mockReturnValue({ rpc });

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
    expect(rpc).toHaveBeenCalledWith('get_public_blog_categories', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('returns null when the blog feature is disabled', async () => {
    mockGetMerchantStrict.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
      feature_settings: { blog_enabled: false },
    });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'smartphones')
    ).resolves.toBeNull();
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns null when the merchant is not found', async () => {
    mockGetMerchantStrict.mockResolvedValue(null);

    await expect(
      resolveBlogCategoryHub('unknown.com', 'smartphones')
    ).resolves.toBeNull();
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns null for unknown category slugs', async () => {
    const rpc = createCategoryRpc({
      data: [{ category: 'Smartphones' }],
      error: null,
    });
    mockGetPublicSupabaseClient.mockReturnValue({ rpc });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'tablets')
    ).resolves.toBeNull();
  });

  it('returns null for ambiguous category slugs', async () => {
    const rpc = createCategoryRpc({
      data: [{ category: 'Cases & Covers' }, { category: 'Cases Covers' }],
      error: null,
    });
    mockGetPublicSupabaseClient.mockReturnValue({ rpc });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'cases-covers')
    ).resolves.toBeNull();
  });

  it('throws when category lookup fails instead of returning a false 404', async () => {
    const rpc = createCategoryRpc({
      data: [],
      error: { message: 'timeout' },
    });
    mockGetPublicSupabaseClient.mockReturnValue({ rpc });

    await expect(
      resolveBlogCategoryHub('ogabassey.com', 'smartphones')
    ).rejects.toThrow('Failed to load blog categories for category hub');
  });
});
