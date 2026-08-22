import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: { id: '550e8400-e29b-41d4-a716-446655440000' },
  }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

import {
  GOOGLE_ADS_CONNECT_PATH,
  GoogleAdsReportingCard,
} from './google-ads-reporting-card';

describe('GoogleAdsReportingCard', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    mockFetchWithCsrf.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers a connect action when the reporting account is disconnected', () => {
    render(<GoogleAdsReportingCard />);

    expect(
      screen.getByText(/connect a google ads reporting account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /connect google ads/i })
    ).toHaveAttribute('href', GOOGLE_ADS_CONNECT_PATH);
  });

  it('keeps loading state explicit and does not show metric values', () => {
    render(<GoogleAdsReportingCard loading />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading Google Ads reporting'
    );
    expect(screen.queryByText('Spend')).not.toBeInTheDocument();
  });

  it('shows a recoverable error without exposing provider details', () => {
    render(
      <GoogleAdsReportingCard
        reporting={{
          connectionStatus: 'error',
          error: 'Google Ads reporting is temporarily unavailable.',
        }}
      />
    );

    expect(
      screen.getByText('Google Ads reporting is temporarily unavailable.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /reconnect google ads/i })
    ).toHaveAttribute('href', GOOGLE_ADS_CONNECT_PATH);
  });

  it('keeps a connected reporting account controllable after a spend read error', () => {
    render(
      <GoogleAdsReportingCard
        reporting={{
          connectionStatus: 'error',
          dataStatus: 'error',
          error: 'Google Ads reporting is temporarily unavailable.',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: /select google ads account/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /reconnect google ads/i })
    ).not.toBeInTheDocument();
  });

  it('does not imply reporting is ready before an account is selected', () => {
    render(
      <GoogleAdsReportingCard
        reporting={{
          connectionStatus: 'connected',
          needsAccountSelection: true,
        }}
      />
    );

    expect(
      screen.getByText(/select a reporting account to start importing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select google ads account/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Spend')).not.toBeInTheDocument();
  });

  it('forwards the sync callback after an account selection completes', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accounts: [{ customerId: '1234567890', selected: false }],
        }),
        { status: 200 }
      )
    );
    mockFetchWithCsrf
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const onSynced = vi.fn();

    render(
      <GoogleAdsReportingCard
        onSynced={onSynced}
        reporting={{
          connectionStatus: 'connected',
          needsAccountSelection: true,
        }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /select google ads account/i })
    );
    await screen.findByRole('radio', { name: /••••7890/i });
    fireEvent.click(screen.getByRole('button', { name: /save account/i }));

    await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/integrations/ads/google/accounts',
      expect.objectContaining({
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
      })
    );
  });

  it('renders only metrics supplied by the reporting provider', () => {
    render(
      <GoogleAdsReportingCard
        reporting={{
          accountName: 'Baci reporting account',
          connectionStatus: 'connected',
          currency: 'NGN',
          metrics: {
            clicks: 48,
            conversions: 3,
            ctr: 2.4,
            impressions: 2000,
            spend: 12500,
          },
        }}
      />
    );

    expect(screen.getByText('Spend')).toBeInTheDocument();
    expect(screen.getByText('Impressions')).toBeInTheDocument();
    expect(screen.getByText('Clicks')).toBeInTheDocument();
    expect(screen.getByText('CTR')).toBeInTheDocument();
    expect(
      screen.getByText('Google-attributed conversions')
    ).toBeInTheDocument();
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();
    expect(screen.queryByText('ROAS')).not.toBeInTheDocument();
    expect(
      screen.getByText('Source: Google Ads reporting')
    ).toBeInTheDocument();
  });

  it('keeps an existing account controllable and labels stale provider data', () => {
    render(
      <GoogleAdsReportingCard
        reporting={{
          connectionStatus: 'connected',
          currency: 'NGN',
          isStale: true,
          metrics: {
            endDate: '2026-08-21',
            spend: 1000,
            startDate: '2026-08-01',
          },
        }}
      />
    );

    expect(
      screen.getByText(/reporting data may be stale/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select google ads account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Reporting window: 2026-08-01 – 2026-08-21')
    ).toBeInTheDocument();
  });
});
