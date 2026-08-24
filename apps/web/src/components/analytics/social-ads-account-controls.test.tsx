import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.useRealTimers();
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
        merchantId="550e8400-e29b-41d4-a716-446655440000"
        needsAccountSelection
        onSynced={onSynced}
        provider="meta_ads"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select account' }));
    expect(await screen.findByText('Baci Meta')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/integrations/ads/meta/accounts',
      expect.objectContaining({
        credentials: 'include',
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save account and sync' })
    );

    await waitFor(() => expect(onSynced).toHaveBeenCalledOnce());
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      1,
      '/api/integrations/ads/meta/accounts',
      expect.objectContaining({
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
        method: 'PATCH',
      })
    );
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
        method: 'POST',
      })
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
        merchantId="550e8400-e29b-41d4-a716-446655440000"
        needsAccountSelection={false}
        provider="tiktok_ads"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(
      await screen.findByText('TikTok reporting is unavailable')
    ).toBeInTheDocument();
  });

  it('syncs the local calendar day near a positive-offset midnight boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 0, 30));
    fetchWithCsrf.mockResolvedValue(new Response('{}'));

    render(
      <SocialAdsAccountControls
        displayName="Meta Ads"
        needsAccountSelection={false}
        provider="meta_ads"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
      await Promise.resolve();
    });

    expect(fetchWithCsrf).toHaveBeenCalledWith(
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-07-22',
        }),
      })
    );
  });

  it('uses the selected analytics window when syncing provider spend', async () => {
    fetchWithCsrf.mockResolvedValue(new Response('{}'));

    render(
      <SocialAdsAccountControls
        displayName="Meta Ads"
        needsAccountSelection={false}
        provider="meta_ads"
        syncWindow={{ endDate: '2026-08-21', startDate: '2026-08-01' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalled());
    expect(fetchWithCsrf).toHaveBeenCalledWith(
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-08-01',
        }),
      })
    );
  });

  it('chunks a long Meta analytics window into provider-safe sync requests', async () => {
    fetchWithCsrf.mockResolvedValue(new Response('{}'));

    render(
      <SocialAdsAccountControls
        displayName="Meta Ads"
        needsAccountSelection={false}
        provider="meta_ads"
        syncWindow={{ endDate: '2026-02-15', startDate: '2026-01-01' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => expect(fetchWithCsrf).toHaveBeenCalledTimes(2));
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      1,
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-01-31',
          startDate: '2026-01-01',
        }),
      })
    );
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/ads/meta/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-02-15',
          startDate: '2026-02-01',
        }),
      })
    );
  });
});
