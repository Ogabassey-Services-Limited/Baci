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
