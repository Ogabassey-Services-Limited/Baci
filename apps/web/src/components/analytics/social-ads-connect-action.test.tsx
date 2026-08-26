import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialAdsConnectAction } from './social-ads-connect-action';

describe('SocialAdsConnectAction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a connect endpoint failure in the dashboard', async () => {
    const initialLocation = window.location.href;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'META_ADS_CONFIG_MISSING' }), {
        headers: { 'content-type': 'application/json' },
        status: 503,
      })
    );

    render(
      <SocialAdsConnectAction
        displayName="Meta Ads"
        href="/api/integrations/ads/meta/connect?merchantId=merchant-1"
        reconnect={false}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /connect meta ads/i }));

    await waitFor(() =>
      expect(screen.getByText('META_ADS_CONFIG_MISSING')).toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/integrations/ads/meta/connect?merchantId=merchant-1',
      { credentials: 'include', redirect: 'manual' }
    );
    expect(
      screen.getByRole('link', { name: /connect meta ads/i })
    ).toBeInTheDocument();
    expect(window.location.href).toBe(initialLocation);
  });

  it('navigates to the provider authorization URL after a redirect response', async () => {
    const navigateTo = vi.fn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        headers: { location: 'https://www.facebook.com/dialog/oauth' },
        status: 302,
      })
    );

    render(
      <SocialAdsConnectAction
        displayName="Meta Ads"
        href="/api/integrations/ads/meta/connect?merchantId=merchant-1"
        navigateTo={navigateTo}
        reconnect={false}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: /connect meta ads/i }));

    await waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith(
        'https://www.facebook.com/dialog/oauth'
      )
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
