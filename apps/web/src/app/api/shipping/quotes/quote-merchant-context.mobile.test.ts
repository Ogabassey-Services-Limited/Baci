import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveQuoteMerchantContext } from './quote-merchant-context';

const mockCreateServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(),
}));

function createRequest(headers: Record<string, string>) {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

describe('body-only mobile storefront quote context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the configured merchant origin instead of defaulting to Lagos', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        business_name: 'Abuja Store',
        business_address: '29 Yedseram Crescent, Maitama, 904101',
        phone: '08012345678',
        country: 'NG',
        state_code: 'FC',
      },
      error: null,
    });
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc,
    });

    const result = await resolveQuoteMerchantContext({
      data: {
        merchantId: 'merchant-abuja',
        shipmentType: 'domestic',
      },
      request: createRequest({
        host: 'usebaci.com',
        'x-baci-client': 'mobile-storefront',
      }),
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: vi.fn(),
      } as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-abuja',
      senderInfo: expect.objectContaining({
        city: 'Maitama',
        state: 'Abuja',
        countryCode: 'NG',
      }),
      merchantCountry: undefined,
      merchantPayoutCurrency: undefined,
    });
    expect(rpc).toHaveBeenCalledWith('get_storefront_shipping_sender', {
      p_merchant_id: 'merchant-abuja',
    });
  });

  it('fails closed when the body-only merchant has no published origin', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });

    await expect(
      resolveQuoteMerchantContext({
        data: { merchantId: 'merchant-missing', shipmentType: 'domestic' },
        request: createRequest({
          host: 'usebaci.com',
          'x-baci-client': 'mobile-storefront',
        }),
        supabase: {
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
          },
          from: vi.fn(),
        } as never,
      })
    ).resolves.toEqual({
      error: 'Merchant shipping origin is not configured',
      ok: false,
      status: 400,
    });
  });
});
