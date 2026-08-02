import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/monnify-provider-config', () => ({
  getMonnifyBaseUrl: () => 'https://sandbox.monnify.com',
}));

import { monnifyRequest } from './monnify-bills-request';

describe('monnifyRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the isolated provider base URL and authenticated request headers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ requestSuccessful: true }),
      ok: true,
    });
    global.fetch = fetchSpy;

    await expect(
      monnifyRequest('/api/v1/vas/bills-payment/billers')
    ).resolves.toEqual({
      requestSuccessful: true,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sandbox.monnify.com/api/v1/vas/bills-payment/billers',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });
});
