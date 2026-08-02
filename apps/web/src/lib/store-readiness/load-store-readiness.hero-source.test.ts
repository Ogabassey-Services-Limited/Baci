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

async function loadHeroReadiness({
  homeConfig,
  templateId,
}: {
  homeConfig: unknown;
  templateId: string;
}) {
  const merchant = query({
    business_address: null,
    business_type: 'ELECTRONICS',
    facebook_pixel_id: null,
    google_analytics_id: null,
    is_published: false,
    pages: null,
    snapchat_pixel_id: null,
    social_media: null,
    template_id: templateId,
    tiktok_pixel_id: null,
    twitter_pixel_id: null,
  });
  const home = query(homeConfig);
  const job = query(null);
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') return merchant;
      if (table === 'page_configs') return home;
      if (table === 'ai_jobs') return job;
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient<Database>;

  return loadStoreReadiness({
    access,
    merchantId: 'merchant-1',
    surface: 'web',
    supabase,
  });
}

describe('loadStoreReadiness active hero source', () => {
  const publishedPuckConfigWithoutHero = {
    id: 'home-1',
    is_published: true,
    published_config: { content: [{ type: 'Products' }], zones: {} },
  };

  it('uses the registered template hero instead of an unused Puck home config', async () => {
    const result = await loadHeroReadiness({
      homeConfig: publishedPuckConfigWithoutHero,
      templateId: 'electronics',
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'hero_carousel', completed: true })
    );
  });

  it('uses the Puck home config for a Puck merchant', async () => {
    const result = await loadHeroReadiness({
      homeConfig: publishedPuckConfigWithoutHero,
      templateId: 'puck',
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'hero_carousel', completed: false })
    );
  });
});
