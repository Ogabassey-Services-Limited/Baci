import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performImeiCheck } from './imei-checker-request';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

describe('performImeiCheck', () => {
  beforeEach(() => {
    mockFetchWithCsrf.mockReset();
  });

  it('marks an insufficient-wallet response for the funding CTA', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        balance: 200,
        code: 'WALLET_INSUFFICIENT',
        required: 1000,
        success: false,
      }),
    });

    const outcome = await performImeiCheck(
      '490154203237518',
      'full',
      1500,
      '00000000-0000-4000-8000-000000000000'
    );

    expect(outcome).toMatchObject({
      error: expect.stringMatching(/insufficient wallet balance/i),
      keepRequestIdentity: false,
      needsWalletFunding: true,
      result: null,
    });
  });

  it('returns a successful result and clears the request identity', async () => {
    const result = { device: 'iPhone 15 Pro', imei: '490154203237518' };
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: result, success: true }),
    });

    await expect(
      performImeiCheck(
        '490154203237518',
        'full',
        1500,
        '00000000-0000-4000-8000-000000000000'
      )
    ).resolves.toEqual({
      error: null,
      keepRequestIdentity: false,
      needsWalletFunding: false,
      result,
    });
  });

  it('preserves the request identity after a network failure', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('offline'));

    await expect(
      performImeiCheck(
        '490154203237518',
        'full',
        1500,
        '00000000-0000-4000-8000-000000000000'
      )
    ).resolves.toMatchObject({
      error: expect.stringMatching(/network error/i),
      keepRequestIdentity: true,
      needsWalletFunding: false,
      result: null,
    });
  });
});
