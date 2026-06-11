import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformSettingsResponse } from '@/app/api/admin/settings/route';
import PlatformSettingsPage from './page';

const mocks = vi.hoisted(() => ({
  apiPut: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiPut: mocks.apiPut,
}));

const settingsResponse: PlatformSettingsResponse = {
  created_at: '2026-06-11T00:00:00.000Z',
  enable_analytics_export: true,
  enable_custom_domains: true,
  enable_merchant_signups: true,
  facebook_pixel_id: '1234567890123456',
  google_analytics_id: 'G-TEST1234',
  id: 'platform-settings',
  maintenance_message: null,
  maintenance_mode: false,
  payment_processor_fee_flat: 0,
  payment_processor_fee_percentage: 1.5,
  platform_fee_flat: 0,
  platform_fee_percentage: 2.5,
  platform_logo_url: null,
  platform_name: 'Baci',
  secretStatus: {
    facebook_capi_token: true,
    ga4_api_secret: true,
    snapchat_capi_token: true,
    tiktok_access_token: true,
  },
  snapchat_pixel_id: 'snap-pixel',
  support_email: 'support@example.com',
  support_phone: '+2348000000000',
  tiktok_pixel_id: 'tiktok-pixel',
  twitter_pixel_id: null,
  updated_at: '2026-06-11T00:00:00.000Z',
};

describe('PlatformSettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.toast.mockClear();
    mocks.apiPut.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => settingsResponse,
        ok: true,
      })
    );
  });

  it('uses specific accessible names for secret visibility toggles', async () => {
    render(<PlatformSettingsPage />);

    expect(
      await screen.findByRole('button', { name: 'Show GA4 API secret' })
    ).toBeInTheDocument();
  });

  it('updates the secret toggle accessible name when visibility changes', async () => {
    render(<PlatformSettingsPage />);

    const ga4Toggle = await screen.findByRole('button', {
      name: 'Show GA4 API secret',
    });

    expect(
      screen.getByRole('button', {
        name: 'Show Facebook Conversions API token',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show TikTok Events API token' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Show Snapchat Conversions API token',
      })
    ).toBeInTheDocument();

    fireEvent.click(ga4Toggle);

    expect(
      screen.getByRole('button', { name: 'Hide GA4 API secret' })
    ).toBeInTheDocument();
  });

  it('announces initial loading and save progress', async () => {
    let resolveSave!: (value: PlatformSettingsResponse) => void;
    mocks.apiPut.mockReturnValue(
      new Promise<PlatformSettingsResponse>((resolve) => {
        resolveSave = resolve;
      })
    );

    render(<PlatformSettingsPage />);

    expect(
      screen.getByText('Loading platform settings...')
    ).toBeInTheDocument();

    const saveButton = await screen.findByRole('button', {
      name: /save changes/i,
    });
    expect(saveButton).toHaveAttribute('aria-busy', 'false');

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(
        'Saving platform settings.'
      );
    });

    resolveSave(settingsResponse);
  });

  it('shows the load failure state when settings cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ error: 'Failed to load settings' }),
        ok: false,
      })
    );

    render(<PlatformSettingsPage />);

    expect(
      await screen.findByText(
        'Failed to load settings. Please try refreshing the page.'
      )
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load platform settings.',
        variant: 'destructive',
      });
    });
  });
});
