import { describe, expect, it } from '@jest/globals';
import {
  mockFetchWithTimeout,
  mockGetSession,
} from '@/lib/wallet-top-up.test-utils';

const { getCustomerSavingsApiClient } =
  require('@/lib/customer-savings-api') as typeof import('@/lib/customer-savings-api');

describe('customer savings API client', () => {
  it('builds merchant identifiers from explicit values and fallback slug', () => {
    const customerSavingsApiClient = getCustomerSavingsApiClient();

    expect(
      customerSavingsApiClient.buildMerchantIdentifiers({
        merchantId: ' 00000000-0000-4000-8000-000000000001 ',
        merchantSlug: ' ogabassey ',
      })
    ).toEqual({
      merchantId: '00000000-0000-4000-8000-000000000001',
      merchantSlug: 'ogabassey',
    });
    expect(customerSavingsApiClient.buildMerchantIdentifiers({})).toEqual({
      merchantId: undefined,
      merchantSlug: 'demo-store',
    });
  });

  it('fetches JSON with auth headers, query params, and POST body', async () => {
    const customerSavingsApiClient = getCustomerSavingsApiClient();

    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true }),
    });

    await expect(
      customerSavingsApiClient.fetchJson({
        body: { amount: 20000 },
        method: 'POST',
        path: '/api/storefront/customer/savings/contributions/manual',
        query: { merchantSlug: 'ogabassey' },
      })
    ).resolves.toEqual({ success: true });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://usebaci.com/api/storefront/customer/savings/contributions/manual?merchantSlug=ogabassey',
      expect.objectContaining({
        body: JSON.stringify({ amount: 20000 }),
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
    );
  });

  it('throws coded server errors', async () => {
    const customerSavingsApiClient = getCustomerSavingsApiClient();

    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        code: 'INSUFFICIENT_WALLET_BALANCE',
        error: 'Insufficient wallet balance',
      }),
    });

    await expect(
      customerSavingsApiClient.fetchJson({
        path: '/api/storefront/customer/savings/goals',
      })
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_WALLET_BALANCE',
      message: 'Insufficient wallet balance',
    });
  });

  it('throws when auth session is missing', async () => {
    const customerSavingsApiClient = getCustomerSavingsApiClient();

    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(
      customerSavingsApiClient.fetchJson({
        path: '/api/storefront/customer/savings/goals',
      })
    ).rejects.toThrow('Authentication required. Please sign in again.');
  });

  it('returns the same client instance after lazy initialization', () => {
    expect(getCustomerSavingsApiClient()).toBe(getCustomerSavingsApiClient());
  });
});
