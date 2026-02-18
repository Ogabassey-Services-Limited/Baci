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
    };

    const supabase = createMockSupabase({
      merchants: mockQueryChain({ data: merchantData, error: null }),
      staff_members: mockQueryChain({ data: null, error: null }),
    });

    const result = await fetchDashboardMerchant(supabase, 'user-1');

    expect(result.merchant?.id).toBe('merchant-1');
    expect(result.staffAccess.isOwner).toBe(true);
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
