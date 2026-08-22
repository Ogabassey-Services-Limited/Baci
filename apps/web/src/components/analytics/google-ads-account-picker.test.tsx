import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

import { GoogleAdsAccountPicker } from './google-ads-account-picker';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

describe('GoogleAdsAccountPicker', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    mockFetchWithCsrf.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('discovers accounts and masks customer ids before rendering choices', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accounts: [
          { customerId: '123-456-7890', selected: false },
          { customerId: '5556667777', selected: true },
        ],
      })
    );

    render(
      <GoogleAdsAccountPicker merchantId="550e8400-e29b-41d4-a716-446655440000" />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /select google ads account/i })
    );

    expect(
      await screen.findByRole('radio', { name: /••••7890/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /••••7777/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('123-456-7890')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/integrations/ads/google/accounts',
      expect.objectContaining({
        credentials: 'include',
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
      })
    );
  });

  it('PATCHes the selected account and starts a spend sync without exposing tokens', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accounts: [{ customerId: '1234567890', selected: false }],
      })
    );
    mockFetchWithCsrf
      .mockResolvedValueOnce(jsonResponse({ selected: true }))
      .mockResolvedValueOnce(jsonResponse({ synced: true }));

    const onSynced = vi.fn();
    render(
      <GoogleAdsAccountPicker
        merchantId="550e8400-e29b-41d4-a716-446655440000"
        onSynced={onSynced}
        syncWindow={{ endDate: '2026-08-21', startDate: '2026-08-01' }}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /select google ads account/i })
    );
    await screen.findByRole('radio', { name: /••••7890/i });
    fireEvent.click(screen.getByRole('button', { name: /save account/i }));

    await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/spend sync started/i)).toBeInTheDocument();
    expect(mockFetchWithCsrf).toHaveBeenNthCalledWith(
      1,
      '/api/integrations/ads/google/accounts',
      expect.objectContaining({
        body: JSON.stringify({ customerId: '1234567890' }),
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
        method: 'PATCH',
      })
    );
    expect(mockFetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/ads/google/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-08-01',
        }),
        headers: {
          'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
        },
        method: 'POST',
      })
    );
  });

  it('shows a recoverable discovery error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Google Ads account discovery failed.' }, 502)
    );

    render(<GoogleAdsAccountPicker />);
    fireEvent.click(
      screen.getByRole('button', { name: /select google ads account/i })
    );

    expect(
      await screen.findByText('Google Ads account discovery failed.')
    ).toBeInTheDocument();
  });

  it('syncs the local calendar day near a positive-offset midnight boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 0, 30));
    fetchMock.mockResolvedValue(
      jsonResponse({
        accounts: [{ customerId: '1234567890', selected: false }],
      })
    );
    mockFetchWithCsrf
      .mockResolvedValueOnce(jsonResponse({ selected: true }))
      .mockResolvedValueOnce(jsonResponse({ synced: true }));

    render(<GoogleAdsAccountPicker />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /select google ads account/i })
      );
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save account/i }));
      await Promise.resolve();
    });

    expect(mockFetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/ads/google/sync',
      expect.objectContaining({
        body: JSON.stringify({
          endDate: '2026-08-21',
          startDate: '2026-07-22',
        }),
      })
    );
  });
});
