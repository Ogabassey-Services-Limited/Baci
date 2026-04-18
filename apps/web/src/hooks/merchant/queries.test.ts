import { describe, expect, it, vi } from 'vitest';
import {
  fetchDashboardMerchant,
  fetchMerchantBySlug,
  fetchPrimaryDomain,
  normalizeFeatureSettings,
} from './queries';

// Helper to build a mock Supabase query chain
function mockQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
}

function createMockSupabase(
  tableHandlers: Record<string, ReturnType<typeof mockQueryChain>>
) {
  return {
    from: vi.fn((table: string) => {
      return (
        tableHandlers[table] ?? mockQueryChain({ data: null, error: null })
      );
    }),
  } as any;
}

describe('normalizeFeatureSettings', () => {
  it('returns first element when given an array', () => {
    const result = normalizeFeatureSettings([
      { pay_on_delivery_enabled: true },
    ]);
    expect(result).toEqual({ pay_on_delivery_enabled: true });
  });

  it('returns the object when given a non-array', () => {
    const obj = { pay_on_delivery_enabled: false };
    expect(normalizeFeatureSettings(obj)).toBe(obj);
  });

  it('returns undefined for undefined input', () => {
    expect(normalizeFeatureSettings(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(normalizeFeatureSettings([])).toBeUndefined();
  });
});

describe('fetchMerchantBySlug', () => {
  it('returns merchant data for valid slug', async () => {
    const merchantData = {
      id: 'merchant-1',
      user_id: 'user-1',
      business_name: 'Test Store',
      business_type: 'FASHION',
      slug: 'test-store',
      feature_settings: [{ pay_on_delivery_enabled: true }],
    };
    const supabase = createMockSupabase({
      merchants: mockQueryChain({ data: merchantData, error: null }),
    });

    const result = await fetchMerchantBySlug(supabase, 'test-store');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('merchant-1');
    // Feature settings should be normalized from array to object
    expect(result?.feature_settings).toEqual({
      pay_on_delivery_enabled: true,
    });
  });

  it('does not request trust, legal, or secret analytics fields in public slug lookups', async () => {
    const merchantsHandler = mockQueryChain({
      data: {
        id: 'merchant-1',
        business_name: 'Test Store',
        business_type: 'FASHION',
        slug: 'test-store',
        feature_settings: null,
      },
      error: null,
    });
    const supabase = createMockSupabase({
      merchants: merchantsHandler,
    });

    await fetchMerchantBySlug(supabase, 'test-store');

    const selectArg = merchantsHandler.select.mock.calls[0]?.[0] as string;
    expect(selectArg).toContain('support_email');
    expect(selectArg).not.toContain('legal_entity_name');
    expect(selectArg).not.toContain('registered_address');
    expect(selectArg).not.toContain('tax_identification_number');
    expect(selectArg).not.toContain('trust_profile');
    expect(selectArg).not.toContain('facebook_capi_token');
    expect(selectArg).not.toContain('ga4_api_secret');
    expect(selectArg).not.toContain('tiktok_access_token');
    expect(selectArg).not.toContain('snapchat_capi_token');
    expect(selectArg).not.toContain('nin');
    expect(selectArg).not.toContain('bvn');
  });

  it('returns null when merchant not found', async () => {
    const supabase = createMockSupabase({
      merchants: mockQueryChain({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      }),
    });

    const result = await fetchMerchantBySlug(supabase, 'nonexistent');
    expect(result).toBeNull();
  });

  it('throws on unexpected errors', async () => {
    const supabase = createMockSupabase({
      merchants: mockQueryChain({
        data: null,
        error: { code: 'PGRST500', message: 'Server error' },
      }),
    });

    await expect(fetchMerchantBySlug(supabase, 'test')).rejects.toEqual({
      code: 'PGRST500',
      message: 'Server error',
    });
  });
});

describe('fetchDashboardMerchant', () => {
  it('returns merchant with owner access for valid owner', async () => {
    const merchantData = {
      id: 'merchant-1',
      user_id: 'user-1',
      business_name: 'Owner Store',
      business_type: 'FASHION',
      slug: 'owner-store',
      feature_settings: null,
      support_email: 'support@ogabassey.com',
      support_phone: '+2348000000000',
      legal_entity_name: 'Ogabassey Gadgets Ltd',
      registered_address: {
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
      },
      tax_identification_number: 'TIN-123',
      trust_profile: {
        founded_year: 2018,
      },
    };

    const supabase = createMockSupabase({
      merchants: mockQueryChain({ data: merchantData, error: null }),
      staff_members: mockQueryChain({ data: null, error: null }),
    });

    const result = await fetchDashboardMerchant(supabase, 'user-1');

    expect(result.merchant?.id).toBe('merchant-1');
    expect(result.merchant?.support_email).toBe('support@ogabassey.com');
    expect(result.merchant?.support_phone).toBe('+2348000000000');
    expect(result.merchant?.legal_entity_name).toBe('Ogabassey Gadgets Ltd');
    expect(result.merchant?.registered_address).toEqual({
      street: '12 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
    });
    expect(result.merchant?.tax_identification_number).toBe('TIN-123');
    expect(result.merchant?.trust_profile).toEqual({
      founded_year: 2018,
    });
    expect(result.staffAccess.isOwner).toBe(true);
    expect(result.staffAccess.isStaff).toBe(false);
  });

  it('treats owner rows without business details as incomplete', async () => {
    const supabase = createMockSupabase({
      merchants: mockQueryChain({
        data: {
          id: 'merchant-1',
          user_id: 'user-1',
          business_name: null,
          business_type: null,
          slug: null,
          feature_settings: null,
        },
        error: null,
      }),
      staff_members: mockQueryChain({ data: null, error: null }),
    });

    const result = await fetchDashboardMerchant(supabase, 'user-1');

    expect(result.merchant).toBeNull();
    expect(result.staffAccess.isOwner).toBe(false);
    expect(result.staffAccess.isStaff).toBe(false);
  });

  it('returns null merchant when no owner and no staff', async () => {
    const supabase = createMockSupabase({
      merchants: mockQueryChain({ data: null, error: null }),
      staff_members: mockQueryChain({ data: null, error: null }),
    });

    const result = await fetchDashboardMerchant(supabase, 'user-1');

    expect(result.merchant).toBeNull();
    expect(result.staffAccess.isOwner).toBe(false);
    expect(result.staffAccess.isStaff).toBe(false);
  });
});

describe('fetchPrimaryDomain', () => {
  it('returns domain when found', async () => {
    const supabase = createMockSupabase({
      domains: mockQueryChain({
        data: { domain: 'store.example.com' },
        error: null,
      }),
    });

    const result = await fetchPrimaryDomain(supabase, 'merchant-1');
    expect(result).toBe('store.example.com');
  });

  it('returns null when no domain found', async () => {
    const supabase = createMockSupabase({
      domains: mockQueryChain({ data: null, error: null }),
    });

    const result = await fetchPrimaryDomain(supabase, 'merchant-1');
    expect(result).toBeNull();
  });
});
