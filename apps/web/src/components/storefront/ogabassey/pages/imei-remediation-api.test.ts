import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithCsrf = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf }));

import { imeiRemediationApi } from './imei-remediation-api';

describe('imeiRemediationApi', () => {
  beforeEach(() => {
    fetchWithCsrf.mockReset();
  });

  it('maps a dark eligibility endpoint to a hidden UI state', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({ error: 'Not found' }),
      ok: false,
      status: 404,
    });

    await expect(
      imeiRemediationApi.eligibility({
        identifier: '490154203237518',
        lookupId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toEqual({ kind: 'hidden' });
  });

  it('returns only server-approved eligible offers', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({
        assessmentId: '22222222-2222-4222-8222-222222222222',
        offers: [
          {
            carrier: 'AT&T',
            id: '33333333-3333-4333-8333-333333333333',
            name: 'AT&T Clean Unlock',
            priceNgn: 100_000,
            priceUsdt: 65,
            refundPolicy: 'refundable',
            successRate: 82,
            turnaround: '1-7 Days',
          },
        ],
        status: 'eligible',
        success: true,
        usdtEnabled: true,
      }),
      ok: true,
      status: 200,
    });

    await expect(
      imeiRemediationApi.eligibility({
        identifier: '490154203237518',
        lookupId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toMatchObject({
      assessmentId: '22222222-2222-4222-8222-222222222222',
      kind: 'eligible',
      offers: [{ carrier: 'AT&T' }],
      usdtEnabled: true,
    });
  });

  it('places the selected offer and preserves an ambiguous status', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({
        orderId: '22222222-2222-4222-8222-222222222222',
        status: 'submission_unknown',
        success: true,
      }),
      ok: true,
      status: 202,
    });

    await expect(
      imeiRemediationApi.place({
        identifier: '490154203237518',
        orderId: '22222222-2222-4222-8222-222222222222',
        paymentCurrency: 'USDT',
        productId: '33333333-3333-4333-8333-333333333333',
      })
    ).resolves.toMatchObject({
      kind: 'pending',
      status: 'submission_unknown',
    });
  });
});
