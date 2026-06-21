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

import { getCachedBlogAuthor } from '@/lib/cached-data';

function createQueryBuilder({
  queryResult = { data: [], count: 0, error: null },
  singleResult = { data: null, error: null },
}: {
  queryResult?: { count?: number | null; data: unknown; error: unknown };
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
    select: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(singleResult),
    textSearch: vi.fn(() => builder),
  };

  Object.defineProperty(builder, 'then', {
    value: (
      resolve: (value: {
        count?: number | null;
        data: unknown;
        error: unknown;
      }) => void,
      reject?: (reason: unknown) => void
    ) => Promise.resolve(queryResult).then(resolve, reject),
  });

  return builder;
}

function buildMerchantRow() {
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
  };
}

function setupBlogAuthorFetch({ posts = [] }: { posts?: unknown[] } = {}) {
  const merchantBuilder = createQueryBuilder({
    singleResult: { data: buildMerchantRow(), error: null },
  });
  const primaryDomainBuilder = createQueryBuilder({
    singleResult: { data: null, error: null },
  });
  const featureSettingsBuilder = createQueryBuilder({
    singleResult: { data: { blog_enabled: true }, error: null },
  });
  const postsBuilder = createQueryBuilder({
    queryResult: { data: posts, count: posts.length, error: null },
  });

  const serviceFrom = vi.fn((table: string) => {
    if (table === 'merchants') {
      return { select: vi.fn(() => merchantBuilder) };
    }

    if (table === 'domains') {
      return { select: vi.fn(() => primaryDomainBuilder) };
    }

    if (table === 'merchant_feature_settings') {
      return { select: vi.fn(() => featureSettingsBuilder) };
    }

    throw new Error(`Unexpected service table: ${table}`);
  });

  const publicFrom = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      return { select: vi.fn(() => postsBuilder) };
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

  return { postsBuilder };
}

describe('getCachedBlogAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes page input and fetches the author posts with a bounded DB query', async () => {
    const { postsBuilder } = setupBlogAuthorFetch({
      posts: [
        {
          id: 'post-1',
          title: 'Bassey Laptop Guide',
          slug: 'bassey-laptop-guide',
          excerpt: 'Laptop picks.',
          featured_image_url: null,
          featured_image_alt: null,
          category: 'Laptops',
          author_name: 'Bassey John',
          author_title: 'Performance Marketing Specialist',
          author_bio: 'Bassey writes buying guides.',
          author_image_url: 'https://cdn.example.com/bassey.jpg',
          published_at: '2026-03-17T10:00:00.000Z',
          reading_time_minutes: 4,
        },
        {
          id: 'post-2',
          title: 'Bassey Phone Guide',
          slug: 'bassey-phone-guide',
          excerpt: 'Phone picks.',
          featured_image_url: null,
          featured_image_alt: null,
          category: 'Smartphones',
          author_name: 'Bassey John',
          author_title: 'Performance Marketing Specialist',
          author_bio: 'Bassey writes buying guides.',
          author_image_url: 'https://cdn.example.com/bassey.jpg',
          published_at: '2026-03-16T10:00:00.000Z',
          reading_time_minutes: 5,
        },
      ],
    });

    const result = await getCachedBlogAuthor('ogabassey', 'Bassey John', {
      page: -2,
    });

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error('Expected blog author result');
    }
    // Bounded query: filter by author_name + paginate at the DB level (no
    // unbounded fetch + in-memory pagination — Jules Medium finding).
    expect(postsBuilder.eq).toHaveBeenCalledWith('author_name', 'Bassey John');
    expect(postsBuilder.range).toHaveBeenCalledWith(0, expect.any(Number));
    expect(postsBuilder.limit).not.toHaveBeenCalled();
    expect(result.author.name).toBe('Bassey John');
    expect(result.posts.map((post) => post.id)).toEqual(['post-1', 'post-2']);
    expect(result.totalPosts).toBe(2);
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
