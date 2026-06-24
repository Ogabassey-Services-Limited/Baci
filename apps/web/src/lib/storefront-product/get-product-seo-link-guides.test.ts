import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSeoGuidePosts } from './get-product-seo-link-guides';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCachedFeatureSettings: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (merchantId: string) =>
    mocks.getCachedFeatureSettings(merchantId),
  getPublicSupabaseClient: () => ({ from: mocks.from }),
}));

interface QueryResponse {
  data: unknown[] | null;
  error: unknown | null;
}

const clusterPosts = [{ slug: 'best-laptops', title: 'Best laptops' }];
const productGuideRows = [
  {
    blog_posts: {
      slug: 'legion-guide',
      title: 'Legion guide',
      excerpt: 'Guide',
      category: 'Guides',
      tags: ['laptops'],
      keywords: ['legion'],
      featured_image_url: null,
      published_at: '2026-06-24T00:00:00Z',
      reading_time_minutes: 4,
      status: 'published',
    },
  },
];

let blogPostsResponses: QueryResponse[];
let productGuidePostsResponse: QueryResponse;
let createdQueries: Record<string, ReturnType<typeof vi.fn>>[];

function createQuery(response: () => QueryResponse) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'not', 'order', 'or', 'contains']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.limit = vi.fn(() => Promise.resolve(response()));
  return builder;
}

function setupSupabaseMock() {
  createdQueries = [];
  mocks.from.mockImplementation((table: string) => {
    const query = createQuery(() =>
      table === 'blog_posts'
        ? (blogPostsResponses.shift() ?? { data: [], error: null })
        : productGuidePostsResponse
    );
    createdQueries.push(query);
    return query;
  });
}

describe('getSeoGuidePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
    blogPostsResponses = [{ data: clusterPosts, error: null }];
    productGuidePostsResponse = { data: productGuideRows, error: null };
    setupSupabaseMock();
  });

  it('uses service-backed feature settings and fetches enough cluster candidates', async () => {
    const result = await getSeoGuidePosts('merchant-1', 'prod-1', 'laptops');

    expect(mocks.getCachedFeatureSettings).toHaveBeenCalledWith('merchant-1');
    expect(mocks.from).not.toHaveBeenCalledWith('merchant_feature_settings');
    expect(mocks.from).toHaveBeenCalledWith('blog_posts');
    expect(mocks.from).toHaveBeenCalledWith('blog_post_products');
    expect(createdQueries[0].limit).toHaveBeenCalledWith(48);
    expect(result.clusterGuidePosts).toEqual(clusterPosts);
    expect(result.productGuidePosts).toEqual([
      expect.objectContaining({ slug: 'legion-guide' }),
    ]);
  });

  it('filters cluster guide candidates by category context before applying the candidate cap', async () => {
    const olderRelevantPost = {
      slug: 'laptop-buying-guide',
      title: 'Laptop buying guide',
      excerpt: 'How to choose a laptop',
      category: 'Laptops',
      tags: ['laptops'],
      keywords: ['buyer guide'],
      featured_image_url: null,
      published_at: '2026-01-01T00:00:00Z',
      reading_time_minutes: 5,
    };
    blogPostsResponses = [{ data: [olderRelevantPost], error: null }];

    const result = await getSeoGuidePosts('merchant-1', 'prod-1', 'laptops');

    expect(createdQueries[0].or).toHaveBeenCalledWith(
      expect.stringContaining('category.ilike.%laptops%')
    );
    expect(createdQueries[0].limit).toHaveBeenCalledWith(48);
    expect(result.clusterGuidePosts).toEqual([olderRelevantPost]);
  });

  it('keeps supported category aliases in the SQL prefilter', async () => {
    const phoneGuide = {
      slug: 'phone-buying-guide',
      title: 'Phone buying guide',
      excerpt: 'How to choose mobile phones',
      category: 'Phones',
      tags: ['phones'],
      keywords: ['buyer guide'],
      featured_image_url: null,
      published_at: '2026-01-01T00:00:00Z',
      reading_time_minutes: 5,
    };
    blogPostsResponses = [{ data: [phoneGuide], error: null }];

    const result = await getSeoGuidePosts(
      'merchant-1',
      'prod-1',
      'smartphones'
    );

    expect(createdQueries[0].or).toHaveBeenCalledWith(
      expect.stringContaining('category.ilike.%phones%')
    );
    expect(createdQueries[0].or).toHaveBeenCalledWith(
      expect.stringContaining('excerpt.ilike.%mobile phones%')
    );
    expect(result.clusterGuidePosts).toEqual([phoneGuide]);
  });

  it('fails open when the cluster guide query is temporarily unavailable', async () => {
    blogPostsResponses = [{ data: [], error: { message: 'timeout' } }];

    await expect(
      getSeoGuidePosts('merchant-1', 'prod-1', 'laptops')
    ).resolves.toEqual({
      clusterGuidePosts: [],
      productGuidePosts: [expect.objectContaining({ slug: 'legion-guide' })],
    });
  });

  it('fails open when the product guide query is temporarily unavailable', async () => {
    productGuidePostsResponse = { data: [], error: { message: 'timeout' } };

    await expect(
      getSeoGuidePosts('merchant-1', 'prod-1', 'laptops')
    ).resolves.toEqual({
      clusterGuidePosts: clusterPosts,
      productGuidePosts: [],
    });
  });

  it('skips guide queries when the blog feature is disabled', async () => {
    mocks.getCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });

    await expect(
      getSeoGuidePosts('merchant-1', 'prod-1', 'laptops')
    ).resolves.toEqual({
      clusterGuidePosts: [],
      productGuidePosts: [],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('fails open when feature settings are temporarily unavailable', async () => {
    mocks.getCachedFeatureSettings.mockRejectedValue(new Error('db timeout'));

    await expect(
      getSeoGuidePosts('merchant-1', 'prod-1', 'laptops')
    ).resolves.toEqual({
      clusterGuidePosts: [],
      productGuidePosts: [],
    });
  });
});
