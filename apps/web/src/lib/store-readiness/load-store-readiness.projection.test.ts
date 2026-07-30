import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccess } from '@/lib/api-auth';
import type { Database } from '@/types/supabase';
import { loadStoreReadiness } from './load-store-readiness';

vi.mock('server-only', () => ({}));

vi.mock('./load-store-launch-readiness', () => ({
  loadStoreLaunchReadiness: vi.fn().mockResolvedValue({
    facts: {
      activeProductCount: 1,
      country: 'NG',
      hasVerifiedIdentity: true,
      kycRequired: false,
      merchantEmail: 'owner@example.com',
      merchantId: 'merchant-1',
      merchantPhone: null,
      paymentRequirement: {
        completed: true,
        description: 'Accept payments',
        id: 'payment_method',
        label: 'Set up payments',
      },
      slug: 'merchant-one',
      supportEmail: null,
      supportPhone: null,
      totalProductCount: 1,
    },
  }),
}));

const access: UserAccess = {
  isOwner: true,
  isStaff: false,
  merchantId: 'merchant-1',
  permissions: {},
  role: 'owner',
};

function query(data: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}

function client() {
  const merchant = query({
    business_address: null,
    facebook_pixel_id: null,
    google_analytics_id: null,
    is_published: false,
    snapchat_pixel_id: null,
    social_media: null,
    tiktok_pixel_id: null,
    twitter_pixel_id: null,
  });
  const home = query(null);
  const job = query(null);

  return {
    merchant,
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'merchants') return merchant;
        if (table === 'page_configs') return home;
        if (table === 'ai_jobs') return job;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>,
  };
}

async function load(surface: 'mobile' | 'web') {
  const readinessClient = client();
  await loadStoreReadiness({
    access,
    merchantId: 'merchant-1',
    surface,
    supabase: readinessClient.supabase,
  });
  return readinessClient.merchant;
}

describe('loadStoreReadiness readiness projection', () => {
  it('excludes web-only legal pages for mobile readiness', async () => {
    const merchant = await load('mobile');

    expect(merchant.select).toHaveBeenCalledWith(
      expect.not.stringContaining('pages')
    );
  });

  it('retains the legal-page projection for web readiness', async () => {
    const merchant = await load('web');

    expect(merchant.select).toHaveBeenCalledWith(
      expect.stringContaining('pages')
    );
  });
});
