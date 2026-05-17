import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { cacheTag } from 'next/cache';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getCachedBlogPost } from '@/lib/cached-data';

function createQueryBuilder({
  queryResult = { data: [], error: null },
  singleResult = { data: null, error: null },
}: {
  queryResult?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
}) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(singleResult),
    neq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(singleResult),
  };

  Object.defineProperty(builder, 'then', {
    value: (
      resolve: (value: { data: unknown; error: unknown }) => void,
      reject?: (reason: unknown) => void
    ) => Promise.resolve(queryResult).then(resolve, reject),
  });

  return builder;
}

// Shared fixture helpers — keep individual tests focused on the behavior
// under assertion instead of restating the full merchant/post row shape.
function buildMerchantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    site_title: 'Ogabassey',
    site_tagline: 'Phones and tablets',
    site_description: 'Phones and tablets',
    business_type: 'electronics',
    logo_url: 'https://cdn.example.com/logo.png',
    phone: '+234800000000',
    email: 'hello@ogabassey.com',
    social_media: null,
    brand_colors: null,
    slug: 'ogabassey',
    business_address: 'Lagos',
    payout_currency: 'NGN',
    is_published: true,
    template_id: 'default',
    plan_tier: 'pro',
    premium_features: null,
    country: 'NG',
    hero_slides: null,
    favicon_svg_url: null,
    favicon_png_32_url: null,
    favicon_apple_touch_url: null,
    vat_registration_status: null,
    vat_rate: null,
    feature_settings: { blog_enabled: true },
    pages: null,
    about_page: null,
    faq_items: null,
    updated_at: '2026-03-28T00:00:00.000Z',
    ...overrides,
  };
}

function buildBlogPostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    slug: 'factory-unlocked-iphones-explained',
    title: 'Factory Unlocked iPhones: Explained',
    ...overrides,
  };
}

interface BlogPostFetchMocks {
  merchantRow: Record<string, unknown>;
  publishedPost: Record<string, unknown>;
  relatedPostsResult?: { data: unknown; error: unknown };
}

function setupBlogPostFetch({
  merchantRow,
  publishedPost,
  relatedPostsResult,
}: BlogPostFetchMocks) {
  const domainLookupBuilder = createQueryBuilder({
    singleResult: {
      data: { merchant_id: 'merchant-1', domain: 'ogabassey.com' },
      error: null,
    },
  });
  const merchantLookupBuilder = createQueryBuilder({
    singleResult: { data: merchantRow, error: null },
  });
  const featureSettingsBuilder = createQueryBuilder({
    singleResult: { data: { blog_enabled: true }, error: null },
  });
  const postLookupBuilder = createQueryBuilder({
    singleResult: { data: publishedPost, error: null },
  });
  const relatedPostsBuilder = createQueryBuilder({
    queryResult: relatedPostsResult,
  });
  const relatedProductsBuilder = createQueryBuilder({});

  const serviceFrom = vi.fn((table: string) => {
    if (table === 'domains') {
      return { select: vi.fn(() => domainLookupBuilder) };
    }

    if (table === 'merchants') {
      return { select: vi.fn(() => merchantLookupBuilder) };
    }

    if (table === 'merchant_feature_settings') {
      return { select: vi.fn(() => featureSettingsBuilder) };
    }

    throw new Error(`Unexpected service table: ${table}`);
  });

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

    throw new Error(`Unexpected public table: ${table}`);
  });

  mockCreateClient.mockImplementation(
    (_url: string, key: string, _options?: unknown) => {
      if (key === 'test-service-role-key') {
        return { from: serviceFrom };
      }

      if (key === 'test-anon-key') {
        return { from: publicFrom };
      }

      throw new Error(`Unexpected Supabase key: ${key}`);
    }
  );

  return { postLookupBuilder, relatedPostsBuilder, relatedProductsBuilder };
}

describe('getCachedBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the merchant custom domain for domain-based blog post lookups', async () => {
    setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow(),
    });

    const result = await getCachedBlogPost(
      'ogabassey.com',
      'factory-unlocked-iphones-explained'
    );

    expect(result?.merchant).toEqual(
      expect.objectContaining({
        business_name: 'Ogabassey',
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
      })
    );
    expect(cacheTag).toHaveBeenCalledWith(
      'blog-posts',
      getBlogCacheTag('ogabassey.com', 'factory-unlocked-iphones-explained')
    );
    expect(cacheTag).toHaveBeenCalledWith('products', 'products-merchant-1');
  });

  it('excludes published posts without a published_at timestamp from detail and related queries', async () => {
    const { postLookupBuilder, relatedPostsBuilder } = setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow(),
    });

    await getCachedBlogPost(
      'ogabassey.com',
      'factory-unlocked-iphones-explained'
    );

    expect(postLookupBuilder.not).toHaveBeenCalledWith(
      'published_at',
      'is',
      null
    );
    expect(relatedPostsBuilder.not).toHaveBeenCalledWith(
      'published_at',
      'is',
      null
    );
    expect(relatedPostsBuilder.not).toHaveBeenCalledWith('title', 'is', null);
    expect(relatedPostsBuilder.not).toHaveBeenCalledWith('slug', 'is', null);
    expect(relatedPostsBuilder.not).toHaveBeenCalledWith(
      'title',
      'ilike',
      'test post%'
    );
    expect(relatedPostsBuilder.not).toHaveBeenCalledWith(
      'slug',
      'ilike',
      '%agent-integration-working%'
    );
    expect(relatedPostsBuilder.limit).toHaveBeenCalledWith(12);
  });

  it('slugifies free-text blog categories before filtering related products', async () => {
    const { relatedProductsBuilder } = setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow({ category: 'Product News' }),
    });

    await getCachedBlogPost(
      'ogabassey.com',
      'factory-unlocked-iphones-explained'
    );

    expect(relatedProductsBuilder.eq).toHaveBeenCalledWith(
      'category_slug',
      'product-news'
    );
  });

  it('returns null for public test posts instead of exposing direct article URLs', async () => {
    setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow({
        slug: 'test-post-agent-integration-working',
        title: 'Test Post: Agent Integration Working',
      }),
    });

    const result = await getCachedBlogPost(
      'ogabassey.com',
      'test-post-agent-integration-working'
    );

    expect(result).toBeNull();
  });

  it('filters test posts from cached related posts', async () => {
    setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow({ category: null }),
      relatedPostsResult: {
        data: [
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
        ],
        error: null,
      },
    });

    const result = await getCachedBlogPost(
      'ogabassey.com',
      'factory-unlocked-iphones-explained'
    );

    expect(result?.relatedPosts).toEqual([
      {
        id: 'related-1',
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
      },
    ]);
  });

  it('over-fetches related posts so public entries can still fill all slots', async () => {
    setupBlogPostFetch({
      merchantRow: buildMerchantRow(),
      publishedPost: buildBlogPostRow({ category: null }),
      relatedPostsResult: {
        data: [
          {
            id: 'related-junk-1',
            slug: 'test-post-agent-integration-working-1',
            title: 'Test Post: Agent Integration Working',
          },
          {
            id: 'related-junk-2',
            slug: 'test-post-agent-integration-working-2',
            title: 'Test Post: Agent Integration Working',
          },
          {
            id: 'related-1',
            slug: 'best-phones-in-nigeria',
            title: 'Best Phones in Nigeria',
          },
          {
            id: 'related-2',
            slug: 'budget-phones-in-nigeria',
            title: 'Budget Phones in Nigeria',
          },
          {
            id: 'related-3',
            slug: 'camera-phones-in-nigeria',
            title: 'Camera Phones in Nigeria',
          },
        ],
        error: null,
      },
    });

    const result = await getCachedBlogPost(
      'ogabassey.com',
      'factory-unlocked-iphones-explained'
    );

    expect(result?.relatedPosts).toEqual([
      {
        id: 'related-1',
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
      },
      {
        id: 'related-2',
        slug: 'budget-phones-in-nigeria',
        title: 'Budget Phones in Nigeria',
      },
      {
        id: 'related-3',
        slug: 'camera-phones-in-nigeria',
        title: 'Camera Phones in Nigeria',
      },
    ]);
  });
});
