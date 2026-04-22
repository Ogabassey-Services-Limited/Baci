import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantSafe = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockCreatePublicClient = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import { getLiveBlogPost } from './live-blog-post';

function createQueryBuilder({
  singleResult = { data: null, error: null },
  listResult = { data: [], error: null },
}: {
  singleResult?: { data: unknown; error: unknown };
  listResult?: { data: unknown[]; error: unknown };
}) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(listResult),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(singleResult),
  };

  return builder;
}

function createPublicClientWithBuilders({
  postLookupBuilder,
  relatedPostsBuilder = createQueryBuilder({}),
  relatedProductsBuilder = createQueryBuilder({}),
}: {
  postLookupBuilder: ReturnType<typeof createQueryBuilder>;
  relatedPostsBuilder?: ReturnType<typeof createQueryBuilder>;
  relatedProductsBuilder?: ReturnType<typeof createQueryBuilder>;
}) {
  const blogBuilders = [postLookupBuilder, relatedPostsBuilder];
  const publicFrom = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      return {
        select: vi.fn(() => {
          const builder = blogBuilders.shift();
          if (!builder) {
            throw new Error('Unexpected extra blog_posts query');
          }
          return builder;
        }),
      };
    }

    if (table === 'products') {
      return {
        select: vi.fn(() => relatedProductsBuilder),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  mockCreatePublicClient.mockReturnValue({ from: publicFrom });

  return {
    postLookupBuilder,
    publicFrom,
    relatedPostsBuilder,
    relatedProductsBuilder,
  };
}

describe('getLiveBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantSafe.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      slug: 'ogabassey',
      logo_url: null,
      country: 'NG',
      custom_domain: 'ogabassey.com',
    });
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the merchant does not exist', async () => {
    mockGetMerchantSafe.mockResolvedValueOnce(null);

    await expect(
      getLiveBlogPost('ogabassey.com', 'best-phones-in-nigeria')
    ).resolves.toBeNull();
  });

  it('returns null when the merchant blog is disabled', async () => {
    mockGetCachedFeatureSettings.mockResolvedValueOnce({ blog_enabled: false });

    await expect(
      getLiveBlogPost('ogabassey.com', 'best-phones-in-nigeria')
    ).resolves.toBeNull();

    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('returns null when the blog post does not exist', async () => {
    createPublicClientWithBuilders({
      postLookupBuilder: createQueryBuilder({
        singleResult: {
          data: null,
          error: null,
        },
      }),
    });

    await expect(
      getLiveBlogPost('ogabassey.com', 'missing-post')
    ).resolves.toBeNull();
  });

  it('logs post lookup errors and returns null', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    createPublicClientWithBuilders({
      postLookupBuilder: createQueryBuilder({
        singleResult: {
          data: null,
          error: { code: 'PGRST500', message: 'boom' },
        },
      }),
    });

    await expect(
      getLiveBlogPost('ogabassey.com', 'broken-post')
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      'Error fetching live blog post:',
      expect.objectContaining({
        code: 'PGRST500',
      })
    );
  });

  it('filters related products by product category instead of comparing to the blog post slug', async () => {
    const { relatedProductsBuilder } = createPublicClientWithBuilders({
      postLookupBuilder: createQueryBuilder({
        singleResult: {
          data: {
            id: 'post-1',
            slug: 'best-phones-in-nigeria',
            category: 'Smartphones',
          },
          error: null,
        },
      }),
    });

    await getLiveBlogPost('ogabassey.com', 'best-phones-in-nigeria');

    expect(relatedProductsBuilder.eq).toHaveBeenCalledWith(
      'category',
      'Smartphones'
    );
    expect(relatedProductsBuilder.neq).not.toHaveBeenCalledWith(
      'slug',
      'best-phones-in-nigeria'
    );
  });

  it('does not constrain related products by category when the post has no category', async () => {
    const { relatedProductsBuilder } = createPublicClientWithBuilders({
      postLookupBuilder: createQueryBuilder({
        singleResult: {
          data: {
            id: 'post-1',
            slug: 'best-phones-in-nigeria',
            category: null,
          },
          error: null,
        },
      }),
    });

    await getLiveBlogPost('ogabassey.com', 'best-phones-in-nigeria');

    expect(relatedProductsBuilder.eq).not.toHaveBeenCalledWith(
      'category',
      expect.anything()
    );
  });
});
