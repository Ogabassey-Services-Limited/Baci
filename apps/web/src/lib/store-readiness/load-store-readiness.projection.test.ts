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

function client({
  aboutPage = null,
  pages = null,
  socialMedia = null,
}: {
  aboutPage?: unknown;
  pages?: unknown;
  socialMedia?: unknown;
} = {}) {
  const merchant = query({
    about_page: aboutPage,
    business_address: null,
    facebook_pixel_id: null,
    google_analytics_id: null,
    is_published: false,
    pages,
    snapchat_pixel_id: null,
    social_media: socialMedia,
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

async function load(
  surface: 'mobile' | 'web',
  merchantDetails: Parameters<typeof client>[0] = {}
) {
  const readinessClient = client(merchantDetails);
  const result = await loadStoreReadiness({
    access,
    merchantId: 'merchant-1',
    surface,
    supabase: readinessClient.supabase,
  });
  return { merchant: readinessClient.merchant, result };
}

describe('loadStoreReadiness readiness projection', () => {
  it('excludes web-only legal pages for mobile readiness', async () => {
    const { merchant } = await load('mobile');

    expect(merchant.select).toHaveBeenCalledWith(
      expect.not.stringContaining('pages')
    );
  });

  it('retains the legal-page projection for web readiness', async () => {
    const { merchant } = await load('web');

    expect(merchant.select).toHaveBeenCalledWith(
      expect.stringContaining('pages')
    );
  });

  it('does not complete content checklist items from JSON arrays', async () => {
    const pages = Object.assign(['about page'], { about: 'injected value' });
    const socialMedia = Object.assign(['instagram'], {
      instagram: '@injected',
    });
    const { result } = await load('web', { pages, socialMedia });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'about_page', completed: false })
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'social_media', completed: false })
    );
  });

  it('completes About Us from populated structured content without legacy pages', async () => {
    const { merchant, result } = await load('web', {
      aboutPage: { story: 'We help merchants sell online.' },
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'about_page', completed: true })
    );
    expect(merchant.select).toHaveBeenCalledWith(
      'is_published, pages, about_page, business_address, social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id, template_id, business_type'
    );
  });
});
