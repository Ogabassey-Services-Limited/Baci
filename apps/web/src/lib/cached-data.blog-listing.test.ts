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

import { getCachedBlogListing } from '@/lib/cached-data';

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

function setupBlogListingFetch() {
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
    queryResult: { data: [], count: 0, error: null },
  });
  const categoriesBuilder = createQueryBuilder({
    queryResult: { data: [], error: null },
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

  const blogBuilders = [postsBuilder, categoriesBuilder];
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

  return { categoriesBuilder, postsBuilder };
}

describe('getCachedBlogListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes public quality filters into the paginated posts query', async () => {
    const { postsBuilder } = setupBlogListingFetch();

    await getCachedBlogListing('ogabassey', { page: 3 });

    expect(postsBuilder.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(postsBuilder.not).toHaveBeenCalledWith('title', 'is', null);
    expect(postsBuilder.not).toHaveBeenCalledWith('slug', 'is', null);
    expect(postsBuilder.neq).toHaveBeenCalledWith('title', '');
    expect(postsBuilder.neq).toHaveBeenCalledWith('slug', '');
    expect(postsBuilder.not).toHaveBeenCalledWith(
      'title',
      'ilike',
      'test post%'
    );
    expect(postsBuilder.not).toHaveBeenCalledWith(
      'slug',
      'ilike',
      '%agent-integration-working%'
    );
    expect(postsBuilder.range).toHaveBeenCalledWith(24, 35);
    expect(postsBuilder.range.mock.invocationCallOrder[0]).toBeGreaterThan(
      postsBuilder.not.mock.invocationCallOrder.at(-1) ?? 0
    );
  });

  it('removes known junk category values in the categories query', async () => {
    const { categoriesBuilder } = setupBlogListingFetch();

    await getCachedBlogListing('ogabassey');

    expect(categoriesBuilder.not).toHaveBeenCalledWith('category', 'is', null);
    expect(categoriesBuilder.not).toHaveBeenCalledWith(
      'category',
      'ilike',
      'gcrblw'
    );
    expect(categoriesBuilder.not).toHaveBeenCalledWith(
      'category',
      'ilike',
      'test'
    );
  });
});
