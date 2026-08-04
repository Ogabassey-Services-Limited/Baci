import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';

const updateMerchant = vi.hoisted(() => vi.fn());
const saveSettings = vi.hoisted(() => vi.fn());
const refreshMerchantSettingsSnapshot = vi.hoisted(() => vi.fn());

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
vi.mock('./save-settings', () => ({
  saveSettings: (...args: unknown[]) => saveSettings(...args),
}));
vi.mock('./refresh-merchant-settings-snapshot', () => ({
  refreshMerchantSettingsSnapshot: (...args: unknown[]) =>
    refreshMerchantSettingsSnapshot(...args),
}));
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
  brand_colors: { accent: '#f00', background: '#fff', primary: '#000' },
  support_email: 'a@example.com',
};

describe('SettingsFormContents profile baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the refreshed canonical baseline after a branding write before saving profile changes', async () => {
    updateMerchant.mockResolvedValueOnce(undefined);
    refreshMerchantSettingsSnapshot.mockResolvedValueOnce({
      business_name: 'Merchant A',
      country: 'NG',
      site_description: '',
      support_email: 'b@example.com',
      support_phone: '',
      updated_at: '2026-08-04T06:30:00.000Z',
    });
    saveSettings.mockResolvedValueOnce({
      heroSaved: false,
      profileSaved: true,
      socialSaved: false,
      snapshot: {
        business_name: 'Merchant A',
        country: 'NG',
        site_description: 'Updated description',
        support_email: '',
        support_phone: '',
        updated_at: '2026-08-04T06:31:00.000Z',
      },
    });

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
      expect(refreshMerchantSettingsSnapshot).toHaveBeenCalledWith(
        'merchant-a'
      );
    });
    expect(screen.getByLabelText('Public support email')).toHaveValue(
      'b@example.com'
    );

    fireEvent.change(screen.getByLabelText('Store description'), {
      target: { value: 'Updated description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          profileBaseline: expect.objectContaining({
            updated_at: '2026-08-04T06:30:00.000Z',
          }),
          data: expect.objectContaining({ support_email: 'b@example.com' }),
        })
      );
    });
  });

  it('rejects an older overlapping refresh after a newer baseline has been applied', async () => {
    let resolveFirst: ((snapshot: Record<string, string>) => void) | undefined;
    let resolveSecond: ((snapshot: Record<string, string>) => void) | undefined;
    updateMerchant.mockResolvedValue(undefined);
    refreshMerchantSettingsSnapshot
      .mockReturnValueOnce(
        new Promise<Record<string, string>>((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise<Record<string, string>>((resolve) => {
          resolveSecond = resolve;
        })
      );
    saveSettings.mockResolvedValue({
      heroSaved: false,
      profileSaved: true,
      socialSaved: false,
      snapshot: {
        business_name: 'Merchant A',
        country: 'NG',
        site_description: 'Updated description',
        support_email: 'new@example.com',
        support_phone: '',
        updated_at: '2026-08-04T06:41:00.000Z',
      },
    });

    render(
      <SettingsFormContents
        initialMerchant={merchant}
        initialBlogEnabled={false}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Change primary color' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Change primary color' })
    );
    await waitFor(() => {
      expect(refreshMerchantSettingsSnapshot).toHaveBeenCalledTimes(2);
    });

    resolveSecond?.({
      business_name: 'Merchant A',
      country: 'NG',
      site_description: '',
      support_email: 'new@example.com',
      support_phone: '',
      updated_at: '2026-08-04T06:40:00.000Z',
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Public support email')).toHaveValue(
        'new@example.com'
      );
    });
    resolveFirst?.({
      business_name: 'Merchant A',
      country: 'NG',
      site_description: '',
      support_email: 'old@example.com',
      support_phone: '',
      updated_at: '2026-08-04T06:39:00.000Z',
    });
    await Promise.resolve();

    fireEvent.change(screen.getByLabelText('Store description'), {
      target: { value: 'Updated description' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ support_email: 'new@example.com' }),
          profileBaseline: expect.objectContaining({
            updated_at: '2026-08-04T06:40:00.000Z',
          }),
        })
      );
    });
  });

  it('preserves a locally changed profile field while advancing the canonical baseline', async () => {
    updateMerchant.mockResolvedValueOnce(undefined);
    refreshMerchantSettingsSnapshot.mockResolvedValueOnce({
      business_name: 'Merchant A',
      country: 'NG',
      site_description: '',
      support_email: 'b@example.com',
      support_phone: '',
      updated_at: '2026-08-04T06:50:00.000Z',
    });
    saveSettings.mockResolvedValueOnce({
      heroSaved: false,
      profileSaved: true,
      socialSaved: false,
      snapshot: {
        business_name: 'Merchant A',
        country: 'NG',
        site_description: '',
        support_email: 'local@example.com',
        support_phone: '',
        updated_at: '2026-08-04T06:51:00.000Z',
      },
    });

    render(
      <SettingsFormContents
        initialMerchant={merchant}
        initialBlogEnabled={false}
      />
    );
    fireEvent.change(screen.getByLabelText('Public support email'), {
      target: { value: 'local@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Change primary color' })
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Public support email')).toHaveValue(
        'local@example.com'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => {
      expect(saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ support_email: 'local@example.com' }),
          profileBaseline: expect.objectContaining({
            support_email: 'b@example.com',
            updated_at: '2026-08-04T06:50:00.000Z',
          }),
        })
      );
    });
  });
});
