import { describe, expect, it, vi } from 'vitest';
import {
  discoverGoogleAdsCustomerIds,
  GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT,
} from './account-discovery';

describe('Google Ads account discovery traversal', () => {
  it('discovers nested clients while preserving direct customers', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/customers/1111111111/googleAds:searchStream')) {
          return new Response(
            JSON.stringify([
              {
                results: [
                  {
                    customerClient: {
                      clientCustomer: 'customers/2222222222',
                      manager: true,
                    },
                  },
                  {
                    customerClient: {
                      clientCustomer: 'customers/3333333333',
                      manager: false,
                    },
                  },
                ],
              },
            ])
          );
        }
        return new Response(
          JSON.stringify([
            {
              results: [
                {
                  customerClient: {
                    clientCustomer: 'customers/4444444444',
                    manager: false,
                  },
                },
              ],
            },
          ])
        );
      });

    await expect(
      discoverGoogleAdsCustomerIds({
        apiRoot: 'https://googleads.googleapis.com/v25',
        createError: (code, status) => new Error(`${code}:${status ?? ''}`),
        directCustomerIds: ['1111111111'],
        fetchImpl,
        headers: { Authorization: 'Bearer access-token' },
      })
    ).resolves.toEqual([
      '1111111111',
      '2222222222',
      '3333333333',
      '4444444444',
    ]);
  });

  it('returns an explicit manager limit error instead of a partial list', async () => {
    const directCustomerIds = Array.from({ length: 21 }, (_, index) =>
      String(1_000_000_000 + index)
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify([])));

    await expect(
      discoverGoogleAdsCustomerIds({
        apiRoot: 'https://googleads.googleapis.com/v25',
        createError: (code, status) => {
          const error = new Error(code) as Error & {
            code?: string;
            status?: number;
          };
          error.code = code;
          error.status = status;
          return error;
        },
        directCustomerIds,
        fetchImpl,
        headers: { Authorization: 'Bearer access-token' },
      })
    ).rejects.toMatchObject({ code: GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT });
    expect(fetchImpl).toHaveBeenCalledTimes(20);
  });
});
