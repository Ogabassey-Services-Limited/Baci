import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSickwCheck } from './imei-lookup-fulfillment';

const LOOKUP_ARGS = {
  apiKey: 'test-key',
  checksIncluded: ['device'],
  imei: '354442067957452',
  serviceId: '1',
  tierName: 'Full Check',
} as const;

describe('requestSickwCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns normalized lookup data when the provider succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        result:
          'Model Name: iPhone 15 Pro\nModel Number: A3101\nBlacklist Status: Clean\niCloud Lock: Off\nSIM-Lock Status: Unlocked\nCarrier: Unlocked',
        status: 'success',
      })
    );

    const result = await requestSickwCheck(LOOKUP_ARGS);

    expect(result).toMatchObject({
      body: {
        data: {
          blacklistStatus: 'Clean',
          carrier: 'Unlocked',
          device: 'iPhone 15 Pro',
          icloudLock: 'Off',
          imei: LOOKUP_ARGS.imei,
          modelNumber: 'A3101',
          simLock: 'Unlocked',
        },
        success: true,
        tier: { checksIncluded: ['device'], name: 'Full Check' },
      },
      ok: true,
      sickwStatus: 'success',
      status: 200,
    });
  });

  it('maps provider not-found messages to a refunded 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ message: 'IMEI not found', status: 'error' })
    );

    const result = await requestSickwCheck(LOOKUP_ARGS);

    expect(result).toMatchObject({
      body: { code: 'SICKW_NOT_FOUND', success: false },
      ok: false,
      refundReason: 'not_found',
      sickwStatus: 'not_found',
      status: 404,
    });
  });

  it.each([
    'Invalid API key',
    'Invalid service id',
  ])('maps provider configuration errors to a refunded 502: %s', async (message) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ message, status: 'error' })
    );

    const result = await requestSickwCheck(LOOKUP_ARGS);

    expect(result).toMatchObject({
      body: { code: 'SICKW_UNAVAILABLE', success: false },
      ok: false,
      refundReason: 'error',
      sickwStatus: 'provider_error',
      status: 502,
    });
  });
});
