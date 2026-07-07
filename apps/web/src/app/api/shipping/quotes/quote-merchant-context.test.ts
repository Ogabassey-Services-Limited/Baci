import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShippingAddress } from '@/lib/shipping/types';
import { resolveQuoteMerchantContext } from './quote-merchant-context';

const mockCreateServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
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
}: {
  domainLookupError?: Error | null;
  slugLookupError?: Error | null;
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
        if (table === 'merchants' && filters.id === 'merchant-1') {
          return Promise.resolve({
            data: {
              business_address: '1 Merchant Road, Ikeja, Lagos',
              business_name: 'Merchant Store',
              phone: '08012345678',
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
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
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
      senderInfo: expect.objectContaining({
        name: 'Merchant Store',
        phone: '08012345678',
        city: 'Ikeja',
        countryCode: 'NG',
      }),
    });
    expect(supabase.from).toHaveBeenCalledWith('merchants');
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
    vi.mocked(hasPermission).mockReturnValue(false);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'staff-user' } },
          error: null,
        }),
      },
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
      }),
    });
  });
});
