import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCacheTag = vi.fn();
const mockGetMerchantStrict = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: (...args: unknown[]) => mockCacheTag(...args),
}));
vi.mock('@/lib/cached-data', () => ({
  getMerchantStrict: (...args: unknown[]) => mockGetMerchantStrict(...args),
  getPublicSupabaseClient: (...args: unknown[]) =>
    mockGetPublicSupabaseClient(...args),
}));
vi.mock('@/lib/ordered-blog-post-product-links', () => ({
  getOrderedBlogPostProductLinks: vi.fn(() =>
    Promise.resolve({ data: [], error: null })
  ),
}));

import { getCachedBlogPost } from './cached-blog-post';

function createQueryBuilder(singleResult?: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    not: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(singleResult)),
  };

  Object.defineProperty(builder, 'then', {
    value: (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  });

  return builder;
}

describe('getCachedBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tags the cached core with merchant settings tags because it includes payout currency', async () => {
    // Arrange
    mockGetMerchantStrict.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      logo_url: null,
      custom_domain: 'ogabassey.com',
      country: 'NG',
      payout_currency: 'NGN',
      social_media: null,
      feature_settings: { blog_enabled: true },
    });
    const postLookupBuilder = createQueryBuilder({
      data: {
        id: 'post-1',
        slug: 'guide',
        title: 'Guide',
        category: null,
      },
      error: null,
    });
    const relatedPostsBuilder = createQueryBuilder();
    const supabase = {
      from: vi.fn(() => ({
        select: vi
          .fn()
          .mockReturnValueOnce(postLookupBuilder)
          .mockReturnValueOnce(relatedPostsBuilder),
      })),
    };
    mockGetPublicSupabaseClient.mockReturnValue(supabase);

    // Act
    const result = await getCachedBlogPost('ogabassey', 'guide', true);

    // Assert
    expect(result?.merchant.payout_currency).toBe('NGN');
    expect(mockCacheTag).toHaveBeenCalledWith(
      'merchant-id-merchant-1',
      'merchant-ogabassey',
      'domain-ogabassey.com'
    );
  });
});
