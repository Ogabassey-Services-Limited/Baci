import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialAdsAccountControls } from './social-ads-account-controls';

const fetchWithCsrf = vi.fn();
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => fetchWithCsrf(...args),
}));

describe('SocialAdsAccountControls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchWithCsrf.mockReset();
  });

  it('selects an accessible account and starts a provider sync', async () => {
    const onSynced = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accounts: [
            {
              accountId: 'act_123',
              currencyCode: 'NGN',
              label: 'Baci Meta',
              selected: false,
              timezoneName: 'Africa/Lagos',
            },
          ],
        })
      )
    );
    fetchWithCsrf.mockResolvedValue(new Response('{}'));

    render(
      <SocialAdsAccountControls
        displayName="Meta Ads"
        needsAccountSelection
        onSynced={onSynced}
        provider="meta_ads"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select account' }));
    expect(await screen.findByText('Baci Meta')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save account and sync' })
    );

    await waitFor(() => expect(onSynced).toHaveBeenCalledOnce());
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      1,
      '/api/integrations/ads/meta/accounts',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows a safe sync error without exposing response internals', async () => {
    fetchWithCsrf.mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'TikTok reporting is unavailable' }),
        {
          status: 502,
        }
      )
    );

    render(
      <SocialAdsAccountControls
        displayName="TikTok Ads"
        needsAccountSelection={false}
        provider="tiktok_ads"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(
      await screen.findByText('TikTok reporting is unavailable')
    ).toBeInTheDocument();
  });
});
