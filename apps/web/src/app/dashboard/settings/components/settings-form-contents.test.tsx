import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';

const updateMerchant = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ reloadMerchant: vi.fn(), updateMerchant }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/app/dashboard/settings/favicon-upload', () => ({
  FaviconUpload: () => null,
}));
vi.mock('@/components/dashboard/dashboard-ad-unit', () => ({
  DashboardAdUnit: () => null,
}));
vi.mock('./hero-carousel-card', () => ({ HeroCarouselCard: () => null }));
vi.mock('./social-media-card', () => ({ SocialMediaCard: () => null }));
vi.mock('./store-features-card', () => ({ StoreFeaturesCard: () => null }));
vi.mock('./branding-card', () => ({
  BrandingCard: ({
    onColorChange,
  }: {
    onColorChange: (role: 'primary', color: string) => void;
  }) => (
    <button type="button" onClick={() => onColorChange('primary', '#13579b')}>
      Change primary color
    </button>
  ),
}));

import { SettingsFormContents } from './settings-form-contents';

const merchant: CachedMerchant = {
  id: 'merchant-a',
  business_name: 'Merchant A',
  site_title: '',
  site_tagline: '',
  site_description: '',
  business_type: 'FASHION',
  logo_url: '',
  phone: '',
  email: '',
  slug: 'merchant-a',
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'default',
  plan_tier: 'free',
  premium_features: null,
  brand_colors: {
    accent: '#ff0000',
    background: '#ffffff',
    primary: '#000000',
  },
};

describe('SettingsFormContents', () => {
  it('saves a changed brand colour through the selected merchant scope', async () => {
    updateMerchant.mockResolvedValueOnce(undefined);

    render(
      <SettingsFormContents
        initialMerchant={merchant}
        initialBlogEnabled={false}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Change primary color' })
    );

    await waitFor(() => {
      expect(updateMerchant).toHaveBeenCalledWith(
        {
          brand_colors: {
            accent: '#ff0000',
            background: '#ffffff',
            primary: '#13579b',
          },
        },
        { merchantId: 'merchant-a', skipReload: true }
      );
    });
  });
});
