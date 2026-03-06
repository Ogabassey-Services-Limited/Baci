import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpsertPageConfig = vi.fn();
const mockMaybeSingleMerchant = vi.fn();
const mockAssignHeroImagesToMerchant = vi.fn();
const mockGenerateInitialTemplate = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'page_configs') {
        return { upsert: mockUpsertPageConfig };
      }
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: mockMaybeSingleMerchant,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

vi.mock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: mockGenerateInitialTemplate,
}));

vi.mock('@/services/hero-image-generator', () => ({
  assignHeroImagesToMerchant: mockAssignHeroImagesToMerchant,
}));

import { scheduleInitialStoreAssets } from './bootstrap';

describe('scheduleInitialStoreAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInitialTemplate.mockResolvedValue({ hero: [] });
    mockUpsertPageConfig.mockResolvedValue({ error: null });
    mockMaybeSingleMerchant.mockResolvedValue({
      data: { hero_slides: null },
      error: null,
    });
    mockAssignHeroImagesToMerchant.mockResolvedValue(undefined);
  });

  it('boots the default page config and hero images inside the deferred callback', async () => {
    let deferred: (() => Promise<void>) | undefined;

    scheduleInitialStoreAssets(
      'merch-1',
      'test-store',
      {
        email: 'merchant@example.com',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Store',
        businessType: 'fashion',
        otherBusinessType: null,
        phone: null,
        slug: 'test-store',
        logoUrl: null,
        brandColors: null,
      },
      (callback) => {
        deferred = callback;
      }
    );

    expect(deferred).toBeTypeOf('function');

    await deferred?.();

    expect(mockGenerateInitialTemplate).toHaveBeenCalledWith({
      businessName: 'Test Store',
      businessType: 'fashion',
      brandColors: {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
      },
      merchant: { id: 'merch-1', slug: 'test-store' },
    });
    expect(mockUpsertPageConfig).toHaveBeenCalledWith(
      {
        merchant_id: 'merch-1',
        page_slug: 'home',
        page_name: 'Home',
        draft_config: { hero: [] },
        published_config: { hero: [] },
        is_published: true,
      },
      { onConflict: 'merchant_id,page_slug' }
    );
    expect(mockAssignHeroImagesToMerchant).toHaveBeenCalledWith(
      'merch-1',
      'fashion',
      false
    );
  });
});
