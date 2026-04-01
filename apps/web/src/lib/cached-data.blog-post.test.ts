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

import { getCachedBlogPost } from '@/lib/cached-data';

function createQueryBuilder({
  singleResult = { data: null, error: null },
}: {
  singleResult?: { data: unknown; error: unknown };
}) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    maybeSingle: vi.fn().mockResolvedValue(singleResult),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(singleResult),
  };

  return builder;
}

describe('getCachedBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the merchant custom domain for domain-based blog post lookups', async () => {
    const merchantRow = {
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

    const publishedPost = {
      id: 'post-1',
      slug: 'factory-unlocked-iphones-explained',
      title: 'Factory Unlocked iPhones: Explained',
    };

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
    const relatedPostsBuilder = createQueryBuilder({});

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
  });
});
