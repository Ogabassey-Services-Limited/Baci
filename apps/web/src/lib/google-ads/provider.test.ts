import { describe, expect, it, vi } from 'vitest';
import {
  fetchGoogleAdsDailySpend,
  getGoogleAdsApiRoot,
  listGoogleAdsAccessibleCustomerIds,
  refreshGoogleAdsAccessToken,
} from './provider';

const reportingConfig = { developerToken: 'developer-token' };

describe('Google Ads provider client', () => {
  it('uses the current default API version and parses accessible accounts', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify(
            String(input).includes('/customers:listAccessibleCustomers')
              ? {
                  resourceNames: [
                    'customers/1234567890',
                    'customers/not-an-id',
                  ],
                }
              : []
          ),
          { status: 200 }
        )
    );

    await expect(
      listGoogleAdsAccessibleCustomerIds(
        'access-token',
        reportingConfig,
        fetchImpl
      )
    ).resolves.toEqual(['1234567890']);
    expect(getGoogleAdsApiRoot()).toContain('/v25');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/v25/customers:listAccessibleCustomers'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'developer-token': 'developer-token',
        }),
      })
    );
  });

  it('discovers customers nested below accessible manager accounts', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/customers:listAccessibleCustomers')) {
          return new Response(
            JSON.stringify({ resourceNames: ['customers/1111111111'] }),
            { status: 200 }
          );
        }
        if (url.includes('/customers/1111111111/googleAds:searchStream')) {
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
            ]),
            { status: 200 }
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
          ]),
          { status: 200 }
        );
      });

    await expect(
      listGoogleAdsAccessibleCustomerIds(
        'access-token',
        reportingConfig,
        fetchImpl
      )
    ).resolves.toEqual([
      '1111111111',
      '2222222222',
      '3333333333',
      '4444444444',
    ]);
    const hierarchyCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).includes('/customers/1111111111/googleAds:searchStream')
    );
    expect(hierarchyCall?.[1]).toMatchObject({
      body: expect.stringContaining('FROM customer_client'),
      method: 'POST',
    });
  });

  it('refreshes an access token without exposing the refresh token in the result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'new-access', expires_in: 3600 }),
        {
          status: 200,
        }
      )
    );

    const result = await refreshGoogleAdsAccessToken(
      {
        clientId: 'client',
        clientSecret: 'secret',
        refreshToken: 'refresh-token',
      },
      fetchImpl
    );

    expect(result.accessToken).toBe('new-access');
    expect(JSON.stringify(result)).not.toContain('refresh-token');
  });

  it('sends a GAQL daily spend query and parses rows', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            results: [
              {
                customer: { currencyCode: 'NGN', id: '1234567890' },
                metrics: {
                  clicks: '1',
                  conversions: '0',
                  costMicros: '2000000',
                  impressions: '10',
                },
                segments: { date: '2026-08-20' },
              },
            ],
          },
        ]),
        { status: 200 }
      )
    );

    const rows = await fetchGoogleAdsDailySpend(
      {
        accessToken: 'access-token',
        customerId: '1234567890',
        endDate: '2026-08-20',
        reportingConfig,
        startDate: '2026-08-20',
      },
      fetchImpl
    );

    expect(rows[0]).toMatchObject({
      currencyCode: 'NGN',
      spendMicros: 2000000,
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      '/customers/1234567890/googleAds:searchStream'
    );
  });
});
