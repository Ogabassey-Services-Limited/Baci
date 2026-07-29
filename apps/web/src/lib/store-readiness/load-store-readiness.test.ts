import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccess } from '@/lib/api-auth';
import { loadStoreReadiness } from './load-store-readiness';

vi.mock('server-only', () => ({}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

function query(result: QueryResult) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  // Supabase query builders are intentionally thenable so awaited count queries resolve.
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  });

  return builder;
}

const access: UserAccess = {
  isOwner: true,
  isStaff: false,
  merchantId: 'merchant-1',
  permissions: {},
  role: 'owner',
};

function client(
  options: {
    homeConfig?: unknown;
    homeError?: { message: string } | null;
    jobError?: { message: string } | null;
    optionalMerchantError?: { message: string } | null;
    activeProductCount?: number;
  } = {}
) {
  const launchMerchant = query({
    data: {
      bank_account_number: '0001112223',
      bank_code: '044',
      country: 'NG',
      email: 'owner@example.com',
      phone: null,
      slug: 'merchant-one',
      support_email: null,
      support_phone: null,
    },
    error: null,
  });
  const optionalMerchant = query({
    data: {
      business_address: null,
      facebook_pixel_id: null,
      google_analytics_id: null,
      is_published: false,
      pages: null,
      snapchat_pixel_id: null,
      social_media: null,
      tiktok_pixel_id: null,
      twitter_pixel_id: null,
    },
    error: options.optionalMerchantError ?? null,
  });
  const settings = query({
    data: {
      korapay_enabled: false,
      pay_on_delivery_enabled: false,
      paystack_enabled: true,
    },
    error: null,
  });
  const activeProducts = query({
    count: options.activeProductCount ?? 1,
    data: null,
    error: null,
  });
  const totalProducts = query({ count: 3, data: null, error: null });
  const products = [activeProducts, totalProducts];
  const home = query({
    data: options.homeConfig ?? {
      id: 'home-1',
      is_published: true,
      published_config: { content: [{ type: 'Hero' }], zones: {} },
    },
    error: options.homeError ?? null,
  });
  const job = query({ data: null, error: options.jobError ?? null });
  const merchants = [launchMerchant, optionalMerchant];
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        const next = merchants.shift();
        if (!next) throw new Error('Unexpected merchant query');
        return next;
      }
      if (table === 'merchant_feature_settings') return settings;
      if (table === 'products') {
        const next = products.shift();
        if (!next) throw new Error('Unexpected product query');
        return next;
      }
      if (table === 'page_configs') return home;
      if (table === 'ai_jobs') return job;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name === 'get_merchant_paystack_subaccount_configured')
        return Promise.resolve({ data: true, error: null });
      if (name === 'get_merchant_identity_verified')
        return Promise.resolve({ data: true, error: null });
      throw new Error(`Unexpected RPC: ${name}`);
    }),
  } as unknown as SupabaseClient;

  return { activeProducts, home, job, optionalMerchant, supabase };
}

async function load(authenticatedClient: ReturnType<typeof client>) {
  return loadStoreReadiness({
    supabase: authenticatedClient.supabase,
    merchantId: 'merchant-1',
    access,
    surface: 'web',
  });
}

describe('loadStoreReadiness', () => {
  it('uses the published home config only and scopes it to the authorized home page', async () => {
    const authenticatedClient = client();

    const result = await load(authenticatedClient);

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'hero_carousel', completed: true })
    );
    expect(authenticatedClient.home.select).toHaveBeenCalledWith(
      'id, published_config, is_published'
    );
    expect(authenticatedClient.home.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(authenticatedClient.home.eq).toHaveBeenCalledWith(
      'page_slug',
      'home'
    );
    expect(authenticatedClient.optionalMerchant.eq).toHaveBeenCalledWith(
      'id',
      'merchant-1'
    );
    expect(authenticatedClient.job.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });

  it('does not complete hero carousel from a draft-only Hero', async () => {
    const authenticatedClient = client({
      homeConfig: {
        draft_config: { content: [{ type: 'Hero' }], zones: {} },
        id: 'home-1',
        is_published: false,
        published_config: null,
      },
    });

    const result = await load(authenticatedClient);

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'hero_carousel', completed: false })
    );
  });

  it('updates both product checklist items from the active product count', async () => {
    const authenticatedClient = client({ activeProductCount: 5 });

    const result = await load(authenticatedClient);

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'first_product', completed: true })
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'multiple_products', completed: true })
    );
  });

  it('keeps product completion tied to the active count', async () => {
    const authenticatedClient = client({ activeProductCount: 0 });

    const result = await load(authenticatedClient);

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'first_product', completed: false })
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'multiple_products', completed: false })
    );
  });

  it.each([
    ['home page config', { homeError: { message: 'page config unavailable' } }],
    ['storefront job', { jobError: { message: 'job unavailable' } }],
    [
      'optional merchant',
      { optionalMerchantError: { message: 'merchant unavailable' } },
    ],
  ])('rejects when the %s query fails', async (_name, options) => {
    await expect(load(client(options))).rejects.toThrow();
  });
});
