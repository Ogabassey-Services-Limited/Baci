import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '@/lib/shipping/types';
import { resolveQuoteMerchantContext } from './quote-merchant-context';

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockCreateScopedClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}));

vi.mock('@/lib/supabase/scoped', () => ({
  createScopedClient: mockCreateScopedClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn((context: unknown) => context),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

const { getMerchantForApiRequest } = await import(
  '@/lib/get-merchant-for-api-request'
);
const { hasPermission } = await import('@/lib/api-auth');

const sender: ShippingAddress = {
  name: 'Caller Origin',
  phone: '08099999999',
  address: 'Caller Road',
  city: 'Aba',
  state: 'Abia',
  country: 'Nigeria',
  countryCode: 'NG',
};

function createRequest(headers: Record<string, string>) {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

function createSupabase({
  domainLookupError = null,
  slugLookupError = null,
  retiredSlug = null,
  retiredMerchantId = 'merchant-renamed',
  aliasLookupError = null,
  merchantCountry,
  merchantPayoutCurrency,
}: {
  domainLookupError?: Error | null;
  slugLookupError?: Error | null;
  retiredSlug?: string | null;
  retiredMerchantId?: string;
  aliasLookupError?: Error | null;
  merchantCountry?: string | null;
  merchantPayoutCurrency?: string | null;
} = {}) {
  const from = vi.fn((table: string) => {
    const filters: Record<string, string> = {};
    const query = {
      eq: vi.fn((column: string, value: string) => {
        filters[column] = value;
        return query;
      }),
      maybeSingle: vi.fn(() => {
        if (table === 'merchants' && filters.slug === 'ogabassey') {
          if (slugLookupError) {
            return Promise.resolve({ data: null, error: slugLookupError });
          }

          return Promise.resolve({ data: { id: 'merchant-1' }, error: null });
        }
        // A retired slug: the live-merchant lookup MISSES (store was renamed),
        // then the alias table resolves it to the current merchant.
        if (
          table === 'merchants' &&
          retiredSlug &&
          filters.slug === retiredSlug
        ) {
          return Promise.resolve({ data: null, error: null });
        }
        if (
          table === 'merchant_slug_aliases' &&
          retiredSlug &&
          filters.old_slug === retiredSlug
        ) {
          if (aliasLookupError) {
            return Promise.resolve({ data: null, error: aliasLookupError });
          }
          return Promise.resolve({
            data: { merchant_id: retiredMerchantId },
            error: null,
          });
        }
        if (table === 'merchants' && filters.id === retiredMerchantId) {
          return Promise.resolve({
            data: {
              business_address: '1 Merchant Road, Ikeja, Lagos',
              business_name: 'Renamed Store',
              phone: '08055554444',
            },
            error: null,
          });
        }
        if (table === 'merchants' && filters.id === 'merchant-1') {
          return Promise.resolve({
            data: {
              business_address: '1 Merchant Road, Ikeja, Lagos',
              business_name: 'Merchant Store',
              phone: '08012345678',
              ...(merchantCountry !== undefined
                ? { country: merchantCountry }
                : {}),
              ...(merchantPayoutCurrency !== undefined
                ? { payout_currency: merchantPayoutCurrency }
                : {}),
            },
            error: null,
          });
        }
        if (table === 'domains' && filters.domain === 'shop.example.com') {
          if (domainLookupError) {
            return Promise.resolve({ data: null, error: domainLookupError });
          }

          return Promise.resolve({
            data: { merchant_id: 'merchant-1' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
    return { select: vi.fn(() => query) };
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from,
  };
}

function createMerchantLookupClientMock(
  overrides: Record<
    string,
    {
      business_address: string;
      business_name: string;
      phone: string;
      country?: string | null;
      payout_currency?: string | null;
      registered_address?: unknown;
      state_code?: string | null;
    }
  > = {
    'merchant-1': {
      business_address: '1 Merchant Road, Ikeja, Lagos',
      business_name: 'Merchant Store',
      phone: '08012345678',
      country: 'NG',
      payout_currency: 'NGN',
    },
    'merchant-renamed': {
      business_address: '1 Merchant Road, Ikeja, Lagos',
      business_name: 'Renamed Store',
      phone: '08055554444',
    },
  }
) {
  return {
    from: vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      const query = {
        eq: vi.fn((column: string, value: string) => {
          filters[column] = value;
          return query;
        }),
        maybeSingle: vi.fn(() => {
          if (table !== 'merchants' || !filters.id) {
            return Promise.resolve({ data: null, error: null });
          }

          const merchant = overrides[filters.id];
          return Promise.resolve({
            data: merchant ?? null,
            error: null,
          });
        }),
      };
      return { select: vi.fn(() => query) };
    }),
  };
}

describe('resolveQuoteMerchantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: 'merchant-auth',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    const merchantLookupClient = createMerchantLookupClientMock();
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      ...merchantLookupClient,
    });
    mockCreateScopedClient.mockReturnValue(merchantLookupClient);
  });

  it('resolves sender details from a trusted storefront subdomain header', async () => {
    const supabase = createSupabase();

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'NGN',
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
        countryCode: 'NG',
      }),
    });
    expect(supabase.from).toHaveBeenCalledWith('merchants');
  });

  it('resolves a renamed store via the retired-slug alias fallback when the old subdomain is still in use', async () => {
    const supabase = createSupabase({
      retiredSlug: 'yodhashop',
      retiredMerchantId: 'merchant-renamed',
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'yodhashop.usebaci.com',
        'x-merchant-slug': 'yodhashop',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-renamed',
      senderInfo: expect.objectContaining({
        name: 'Renamed Store',
        phone: '08055554444',
      }),
    });
    expect(supabase.from).toHaveBeenCalledWith('merchant_slug_aliases');
  });

  it('surfaces retired-slug alias lookup errors instead of silently dropping merchant context', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabase({
      retiredSlug: 'yodhashop',
      aliasLookupError: new Error('alias table down'),
    });

    const result = await resolveQuoteMerchantContext({
      data: {
        merchantId: 'merchant-body',
        shipmentType: 'international',
      },
      request: createRequest({
        host: 'yodhashop.usebaci.com',
        'x-merchant-slug': 'yodhashop',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      error: 'Failed to resolve storefront merchant',
      ok: false,
      status: 500,
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Error resolving storefront merchant alias:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('does not trust spoofed storefront headers on the platform host', async () => {
    const supabase = createSupabase();

    const result = await resolveQuoteMerchantContext({
      data: {
        merchantId: 'merchant-body',
        sender,
        shipmentType: 'domestic',
      },
      request: createRequest({
        host: 'usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-body',
      senderInfo: sender,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces trusted storefront slug lookup errors instead of falling back to caller merchantId', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabase({
      slugLookupError: new Error('database unavailable'),
    });

    const result = await resolveQuoteMerchantContext({
      data: {
        merchantId: 'merchant-body',
        shipmentType: 'international',
      },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      error: 'Failed to resolve storefront merchant',
      ok: false,
      status: 500,
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Error resolving storefront merchant slug:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('surfaces trusted storefront domain lookup errors instead of falling back to caller merchantId', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabase({
      domainLookupError: new Error('domain lookup failed'),
    });

    const result = await resolveQuoteMerchantContext({
      data: {
        merchantId: 'merchant-body',
        shipmentType: 'international',
      },
      request: createRequest({
        host: 'shop.example.com',
        'x-merchant-domain': 'shop.example.com',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      error: 'Failed to resolve storefront merchant',
      ok: false,
      status: 500,
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Error resolving storefront merchant domain:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('uses trusted storefront context when an authenticated user lacks fulfillment permission', async () => {
    const supabase = createSupabase();
    const merchantLookupClient = createMerchantLookupClientMock();
    vi.mocked(hasPermission).mockReturnValue(false);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'staff-user' } },
          error: null,
        }),
      },
      ...merchantLookupClient,
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'NGN',
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
      }),
    });
  });

  it('passes through the resolved merchant country on a trusted storefront subdomain', async () => {
    const supabase = createSupabase({ merchantCountry: 'IN' });
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      ...createMerchantLookupClientMock({
        'merchant-1': {
          business_address: '1 Merchant Road, Ikeja, Lagos',
          business_name: 'Merchant Store',
          phone: '08012345678',
          country: 'IN',
        },
      }),
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
        countryCode: 'NG',
      }),
      merchantCountry: 'IN',
    });
  });

  it('passes through the merchant payout currency on a trusted storefront subdomain', async () => {
    const supabase = createSupabase({
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'GHS',
    });
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      ...createMerchantLookupClientMock({
        'merchant-1': {
          business_address: '1 Merchant Road, Ikeja, Lagos',
          business_name: 'Merchant Store',
          phone: '08012345678',
          country: 'NG',
          payout_currency: 'GHS',
        },
      }),
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
        countryCode: 'NG',
      }),
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'GHS',
    });
  });

  it('prefers trusted storefront context over an ambient authenticated merchant session', async () => {
    const supabase = createSupabase();
    const merchantLookupClient = createMerchantLookupClientMock();
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'merchant-user' } },
          error: null,
        }),
      },
      ...merchantLookupClient,
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'international' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'NGN',
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
      }),
    });
  });

  it('loads trusted sender details through the request-scoped merchant lookup client', async () => {
    const adminSupabase = createSupabase();
    const scopedMerchantFrom = vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      const query = {
        eq: vi.fn((column: string, value: string) => {
          filters[column] = value;
          return query;
        }),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data:
              table === 'merchants' && filters.id === 'merchant-1'
                ? {
                    business_address: '29 Yedseram Crescent, Maitama, 904101',
                    business_name: 'Scoped Merchant Store',
                    phone: '08012345678',
                    country: 'NG',
                    payout_currency: 'NGN',
                    registered_address: null,
                    state_code: null,
                  }
                : null,
            error: null,
          })
        ),
      };
      return { select: vi.fn(() => query) };
    });
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: scopedMerchantFrom,
    });

    const result = await resolveQuoteMerchantContext({
      data: { shipmentType: 'domestic' },
      request: createRequest({
        host: 'ogabassey.usebaci.com',
        'x-merchant-slug': 'ogabassey',
      }),
      supabase: adminSupabase as never,
    });

    expect(result).toEqual({
      ok: true,
      merchantId: 'merchant-1',
      merchantCountry: 'NG',
      merchantPayoutCurrency: 'NGN',
      senderInfo: expect.objectContaining({
        name: 'Scoped Merchant Store',
        city: 'Maitama',
        state: 'Abuja',
      }),
    });
    expect(scopedMerchantFrom).toHaveBeenCalledWith('merchants');
    expect(
      vi
        .mocked(adminSupabase.from)
        .mock.calls.filter(([table]) => table === 'merchants')
    ).toHaveLength(1);
  });
});
