import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';

const updateMerchant = vi.hoisted(() => vi.fn());
const saveSettings = vi.hoisted(() => vi.fn());

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
vi.mock('./hero-carousel-card', () => ({
  HeroCarouselCard: ({
    onSlidesChange,
  }: {
    onSlidesChange: (slides: Array<{ id: string }>) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSlidesChange([{ id: 'newer-hero-slide' }])}
    >
      Edit hero slides
    </button>
  ),
}));
vi.mock('./social-media-card', () => ({
  SocialMediaCard: ({
    onSocialMediaChange,
  }: {
    onSocialMediaChange: (socialMedia: Record<string, string>) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSocialMediaChange({ twitter: '@newer-draft' })}
    >
      Edit social links
    </button>
  ),
}));
vi.mock('./save-settings', () => ({
  saveSettings: (...args: unknown[]) => saveSettings(...args),
}));
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves newer profile, social, and hero drafts after an in-flight save resolves', async () => {
    const savedProfileResult = {
      heroSaved: false,
      profileSaved: true,
      socialSaved: false,
      snapshot: {
        business_name: 'Merchant A',
        country: 'NG',
        site_description: 'Submitted description',
        support_email: '',
        support_phone: '',
        updated_at: '2026-08-04T06:00:00.000Z',
      },
    };
    let resolveSave: ((result: typeof savedProfileResult) => void) | undefined;
    saveSettings.mockReturnValueOnce(
      new Promise<typeof savedProfileResult>((resolve) => {
        resolveSave = resolve;
      })
    );

    render(
      <SettingsFormContents
        initialMerchant={merchant}
        initialBlogEnabled={false}
      />
    );
    fireEvent.change(screen.getByLabelText('Store description'), {
      target: { value: 'Submitted description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Store description'), {
      target: { value: 'Newer description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit social links' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit hero slides' }));
    resolveSave?.(savedProfileResult);

    await waitFor(() => {
      expect(screen.getByLabelText('Store description')).toHaveValue(
        'Newer description'
      );
    });

    saveSettings.mockResolvedValueOnce({
      heroSaved: true,
      profileSaved: true,
      socialSaved: true,
      snapshot: {
        ...savedProfileResult.snapshot,
        site_description: 'Newer description',
        updated_at: '2026-08-04T07:00:00.000Z',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            site_description: 'Newer description',
          }),
          profileBaseline: expect.objectContaining({
            site_description: 'Submitted description',
            updated_at: '2026-08-04T06:00:00.000Z',
          }),
          heroSlidesEdited: true,
          socialMedia: { twitter: '@newer-draft' },
        })
      );
    });
  });

  it('prefills the shared storefront-profile fields from the selected merchant', () => {
    render(
      <SettingsFormContents
        initialMerchant={{
          ...merchant,
          site_description: 'Quality products for everyday life.',
          support_email: 'support@example.com',
          support_phone: '+2348000000000',
        }}
        initialBlogEnabled={false}
      />
    );

    expect(screen.getByLabelText('Store description')).toHaveValue(
      'Quality products for everyday life.'
    );
    expect(screen.getByLabelText('Public support email')).toHaveValue(
      'support@example.com'
    );
    expect(screen.getByLabelText('Public support phone')).toHaveValue(
      '+2348000000000'
    );
  });

  it('adopts the canonical profile after a social-only save when profile fields are untouched', async () => {
    saveSettings.mockResolvedValueOnce({
      heroSaved: false,
      profileSaved: false,
      socialSaved: true,
      snapshot: {
        business_name: 'Merchant A',
        country: 'NG',
        site_description: 'Canonical description',
        support_email: 'support@example.com',
        support_phone: '+2348000000000',
        updated_at: '2026-08-04T06:00:00.000Z',
      },
    });

    render(
      <SettingsFormContents
        initialMerchant={merchant}
        initialBlogEnabled={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit social links' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Store description')).toHaveValue(
        'Canonical description'
      );
    });
  });

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
