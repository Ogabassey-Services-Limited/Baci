import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: vi.fn(),
  getMerchantSafe: vi.fn(),
}));

vi.mock('@/lib/storefront-blog-post-select', () => ({
  STOREFRONT_BLOG_POST_SELECT: 'id, title, slug',
}));

const mockSingle = vi.fn();

// Mutable result that `.then()` on the builder resolves with.
// Tests set this before calling getLiveBlogPost to control related-posts output.
const relatedQueryResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

const mockQueryBuilder: Record<string, unknown> = {};
mockQueryBuilder.eq = vi.fn(() => mockQueryBuilder);
mockQueryBuilder.neq = vi.fn(() => mockQueryBuilder);
mockQueryBuilder.not = vi.fn(() => mockQueryBuilder);
mockQueryBuilder.order = vi.fn(() => mockQueryBuilder);
mockQueryBuilder.limit = vi.fn(() => mockQueryBuilder);
mockQueryBuilder.single = mockSingle;
Object.defineProperty(mockQueryBuilder, 'then', {
  value: (
    resolve: (val: { data: unknown; error: unknown }) => void,
    reject?: (err: unknown) => void
  ) => Promise.resolve(relatedQueryResult).then(resolve, reject),
});

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => mockQueryBuilder),
    })),
  })),
}));

import { getCachedFeatureSettings, getMerchantSafe } from '@/lib/cached-data';
import { getLiveBlogPost } from '@/lib/live-blog-post';

const mockMerchant = {
  id: 'merchant-123',
  business_name: 'Test Store',
  slug: 'test-store',
  logo_url: 'https://example.com/logo.png',
  custom_domain: 'shop.example.com',
};

describe('getLiveBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relatedQueryResult.data = [];
    relatedQueryResult.error = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when postSlug is empty', async () => {
    const result = await getLiveBlogPost('test-store', '');
    expect(result).toBeNull();
  });

  it('returns null when postSlug is only whitespace', async () => {
    const result = await getLiveBlogPost('test-store', '   ');
    expect(result).toBeNull();
  });

  it('looks up merchant by domain when identifier contains a dot and no slash', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const result = await getLiveBlogPost('shop.example.com', 'my-post');
    expect(getMerchantSafe).toHaveBeenCalledWith('shop.example.com');
    expect(result).toBeNull();
  });

  it('looks up merchant by slug when identifier has no dot', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const result = await getLiveBlogPost('test-store', 'my-post');
    expect(getMerchantSafe).toHaveBeenCalledWith('test-store');
    expect(result).toBeNull();
  });

  it('returns null when merchant is not found', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const result = await getLiveBlogPost('unknown-store', 'my-post');
    expect(result).toBeNull();
  });

  it('returns null when blog is not enabled', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: false,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    const result = await getLiveBlogPost('test-store', 'my-post');
    expect(result).toBeNull();
  });

  it('returns null when blog post is not found', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getLiveBlogPost('test-store', 'my-post');
    expect(result).toBeNull();
  });

  it('returns post with merchant data and related posts on success', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    const mockPost = {
      id: 'post-1',
      title: 'Useful Post',
      slug: 'my-post',
      category: 'tech',
    };

    mockSingle.mockResolvedValueOnce({ data: mockPost, error: null });

    relatedQueryResult.data = [
      { id: 'related-1', slug: 'related-post', title: 'Related Post' },
    ];
    relatedQueryResult.error = null;

    const result = await getLiveBlogPost('test-store', 'my-post');

    expect(result).not.toBeNull();
    expect(result?.merchant.id).toBe('merchant-123');
    expect(result?.merchant.business_name).toBe('Test Store');
    expect(result?.post).toEqual(mockPost);
    expect(result?.relatedPosts).toEqual([
      { id: 'related-1', slug: 'related-post', title: 'Related Post' },
    ]);
  });

  it('excludes published posts without a published_at timestamp from live detail and related queries', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        title: 'Useful Post',
        slug: 'my-post',
        category: null,
      },
      error: null,
    });

    await getLiveBlogPost('test-store', 'my-post');

    expect(mockQueryBuilder.not).toHaveBeenCalledWith(
      'published_at',
      'is',
      null
    );
    expect(mockQueryBuilder.not).toHaveBeenCalledTimes(2);
  });

  it('slugifies free-text blog categories before filtering related products', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        title: 'Useful Post',
        slug: 'my-post',
        category: 'Product News',
      },
      error: null,
    });

    relatedQueryResult.data = [];
    relatedQueryResult.error = null;

    await getLiveBlogPost('test-store', 'my-post');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'category_slug',
      'product-news'
    );
  });

  it('returns empty relatedPosts when related posts query errors', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    const mockPost = {
      id: 'post-1',
      title: 'Useful Post',
      slug: 'my-post',
      category: null,
    };

    mockSingle.mockResolvedValueOnce({ data: mockPost, error: null });

    relatedQueryResult.data = null;
    relatedQueryResult.error = { message: 'DB error' };

    const result = await getLiveBlogPost('test-store', 'my-post');

    expect(result).not.toBeNull();
    expect(result?.relatedPosts).toEqual([]);
  });

  it('filters test and agent-integration posts from related posts', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        title: 'Useful Post',
        slug: 'useful-post',
        category: null,
      },
      error: null,
    });

    relatedQueryResult.data = [
      {
        id: 'related-1',
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
      },
      {
        id: 'related-2',
        slug: 'test-post-agent-integration-working',
        title: 'Test Post: Agent Integration Working',
      },
    ];
    relatedQueryResult.error = null;

    const result = await getLiveBlogPost('test-store', 'useful-post');

    expect(result?.relatedPosts).toEqual([
      {
        id: 'related-1',
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
      },
    ]);
  });

  it('returns null for public test posts instead of exposing direct article URLs', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        title: 'Test Post: Agent Integration Working',
        slug: 'test-post-agent-integration-working',
        category: null,
      },
      error: null,
    });

    const result = await getLiveBlogPost(
      'test-store',
      'test-post-agent-integration-working'
    );

    expect(result).toBeNull();
  });

  it('normalizes postSlug to lowercase and trimmed', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    await getLiveBlogPost('test-store', '  My-Post  ');

    // The slug should be normalized before being used in the query
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('slug', 'my-post');
  });

  it('does not filter related products by category_slug when post category is empty/whitespace', async () => {
    // Negative case: the slugifier returns null for whitespace-only categories,
    // so the related-products query should skip the .eq('category_slug', …)
    // filter rather than query with an empty or normalized-null value.
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        title: 'Useful Post',
        slug: 'my-post',
        // whitespace-only category — slugifier returns null
        category: '   ',
      },
      error: null,
    });

    relatedQueryResult.data = [];
    relatedQueryResult.error = null;

    const result = await getLiveBlogPost('test-store', 'my-post');

    expect(result).not.toBeNull();
    // Related-products branch should be skipped entirely — no `.eq` call on
    // category_slug should appear (since we never enter the products query).
    expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith(
      'category_slug',
      expect.anything()
    );
    expect(result?.relatedProducts).toEqual([]);
  });

  it('returns null and logs error for non-PGRST116 post errors', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(mockMerchant as never);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    });

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST500', message: 'Internal error' },
    });

    const result = await getLiveBlogPost('test-store', 'my-post');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching live blog post:',
      expect.objectContaining({ code: 'PGRST500' })
    );
  });
});
