import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTrackError = jest.fn();

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { trackFetchFailure } from './track-fetch-failure';

describe('trackFetchFailure', () => {
  beforeEach(() => {
    mockTrackError.mockClear();
  });

  it('reports classified failures with category and retryability metadata', () => {
    const classified = trackFetchFailure(
      'checkout_savings_goals_fetch',
      new Error(
        'fetch failed: java.net.UnknownHostException: Unable to resolve host "usebaci.com": No address associated with hostname'
      ),
      { merchant_slug: 'ogabassey', retry_count: 2 }
    );

    expect(classified.category).toBe('dns');
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_savings_goals_fetch',
      expect.stringContaining('UnknownHostException'),
      expect.objectContaining({
        error_category: 'dns',
        error_retryable: true,
        merchant_slug: 'ogabassey',
        retry_count: 2,
      })
    );
  });

  it('reports unrequested aborts as retryable network failures when callerAborted is false', () => {
    const classified = trackFetchFailure(
      'checkout_savings_goals_fetch',
      new Error('Fetch request has been canceled'),
      undefined,
      { callerAborted: false }
    );

    expect(classified.category).toBe('network');
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_savings_goals_fetch',
      'Fetch request has been canceled',
      expect.objectContaining({
        error_category: 'network',
        error_retryable: true,
      })
    );
  });

  it('does not report intentional cancellations', () => {
    const classified = trackFetchFailure(
      'checkout_savings_goals_fetch',
      new Error('Fetch request has been canceled')
    );

    expect(classified.category).toBe('cancelled');
    expect(classified.isReportable).toBe(false);
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('returns the classification so callers can branch on it', () => {
    const classified = trackFetchFailure('checkout_saved_addresses_fetch', {
      message: 'JWT expired',
      code: 'PGRST301',
    });

    expect(classified).toMatchObject({
      category: 'auth',
      isRetryable: false,
      isReportable: true,
    });
  });
});
