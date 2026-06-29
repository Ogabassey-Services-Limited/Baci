import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import { waitForReceiptClaimLoginStartedTrackingWindow } from './wait-for-receipt-claim-login-started-tracking';

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

const mockedFetchWithCsrf = vi.mocked(fetchWithCsrf);

describe('waitForReceiptClaimLoginStartedTrackingWindow', () => {
  beforeEach(() => {
    mockedFetchWithCsrf.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records login-started activity for the claim token', async () => {
    mockedFetchWithCsrf.mockResolvedValue(new Response('{}'));

    await waitForReceiptClaimLoginStartedTrackingWindow('claim token');

    expect(mockedFetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/receipts/claims/claim%20token/login-email',
      {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        keepalive: true,
        method: 'POST',
      }
    );
  });

  it('ignores tracking failures so navigation can continue', async () => {
    mockedFetchWithCsrf.mockRejectedValue(new Error('network failed'));

    await expect(
      waitForReceiptClaimLoginStartedTrackingWindow('claim-token')
    ).resolves.toBeUndefined();
  });

  it('does not send tracking when the claim token is empty', async () => {
    await waitForReceiptClaimLoginStartedTrackingWindow('');

    expect(mockedFetchWithCsrf).not.toHaveBeenCalled();
  });

  it('resolves when the tracking request does not settle before the timeout', async () => {
    vi.useFakeTimers();
    mockedFetchWithCsrf.mockReturnValue(new Promise<Response>(() => undefined));

    const trackingPromise =
      waitForReceiptClaimLoginStartedTrackingWindow('claim-token');
    await vi.advanceTimersByTimeAsync(750);

    await expect(trackingPromise).resolves.toBeUndefined();
  });
});
