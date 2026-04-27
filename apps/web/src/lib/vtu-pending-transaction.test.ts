import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preparePendingVtuTransaction } from '@/lib/vtu-pending-transaction';

const {
  mockFormatPhoneNumber,
  mockIsValidPhoneNumber,
  mockGenerateRequestRef,
  mockCalculateCommerce,
} = vi.hoisted(() => ({
  mockFormatPhoneNumber: vi.fn((value: string) => value),
  mockIsValidPhoneNumber: vi.fn(() => true),
  mockGenerateRequestRef: vi.fn(() => 'VTU-REF-123'),
  mockCalculateCommerce: vi.fn(() =>
    Promise.resolve({
      merchantEarning: 10,
      platformEarning: 5,
    })
  ),
}));

vi.mock('@/lib/kuda', () => ({
  NetworkProvider: {
    MTN: 'MTN',
    AIRTEL: 'AIRTEL',
    GLO: 'GLO',
    MOBILE_9: '9MOBILE',
  },
  formatPhoneNumber: mockFormatPhoneNumber,
  isValidPhoneNumber: mockIsValidPhoneNumber,
  generateRequestRef: () => mockGenerateRequestRef(),
}));

vi.mock('@/lib/supabase/client', () => ({
  calculateCommerce: mockCalculateCommerce,
}));

type PrepareSupabase = Parameters<
  typeof preparePendingVtuTransaction
>[0]['supabase'];

function createMockSupabase({
  merchant = {},
  settings = {},
  customer = {},
  insertRow = {},
}: {
  customer?: Record<string, unknown>;
  insertRow?: Record<string, unknown>;
  merchant?: Record<string, unknown>;
  settings?: Record<string, unknown>;
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'OgaBassey',
      paystack_subaccount_code: null,
      ...merchant,
    },
    error: null,
  });
  const settingsSingle = vi.fn().mockResolvedValue({
    data: {
      vtu_enabled: true,
      vtu_airtime_enabled: true,
      paystack_enabled: true,
      korapay_enabled: true,
      ...settings,
    },
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'customer-1',
      email: 'customer@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '08012345678',
      user_id: 'user-1',
      ...customer,
    },
    error: null,
  });
  const insertSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'vtu-1',
      amount: 1000,
      customer_identifier: null,
      metadata: {},
      request_reference: 'VTU-REF-123',
      status: 'pending',
      type: 'airtime',
      ...insertRow,
    },
    error: null,
  });
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: insertSingle }),
  });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
        };
      }
      if (table === 'merchant_feature_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: settingsSingle }),
          }),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        };
      }
      return { insert };
    }),
  } as unknown as PrepareSupabase;

  return { insert, supabase };
}

function prepareAirtime(supabase: PrepareSupabase, networkProvider = 'mtn') {
  return preparePendingVtuTransaction({
    supabase,
    user: {
      id: 'user-1',
      email: 'customer@example.com',
    } as unknown as Parameters<typeof preparePendingVtuTransaction>[0]['user'],
    input: {
      merchantSlug: 'ogabassey',
      type: 'airtime',
      amount: 1000,
      phoneNumber: '08012345678',
      networkProvider,
      source: 'checkout',
    },
    source: 'checkout',
    requireCustomer: true,
  });
}

describe('preparePendingVtuTransaction', () => {
  beforeEach(() => {
    mockCalculateCommerce.mockClear();
  });

  it('creates a pending VTU row with computed commissions', async () => {
    const { insert, supabase } = createMockSupabase({
      settings: {
        vtu_customer_cashback_enabled: true,
        vtu_customer_cashback_rate: 50,
      },
    });

    const result = await prepareAirtime(supabase);

    expect(result.requestReference).toBe('VTU-REF-123');
    expect(result.customerCashback).toBe(5);
    expect(result.effectiveMerchantEarning).toBe(5);
    expect(mockCalculateCommerce).toHaveBeenCalledWith('calculate_vtu', {
      amount: 1000,
      category: 'AIRTIME',
      merchantSplit: 50,
      provider: 'MTN',
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ network_provider: 'MTN' })
    );
  });

  it('uses percentage-based merchant commission rates without multiplying twice', async () => {
    const { supabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 50 },
    });

    const result = await prepareAirtime(supabase);

    expect(result.customerCashback).toBe(0);
    expect(result.effectiveMerchantEarning).toBe(10);
    expect(mockCalculateCommerce).toHaveBeenLastCalledWith('calculate_vtu', {
      amount: 1000,
      category: 'AIRTIME',
      merchantSplit: 50,
      provider: 'MTN',
    });
  });

  it('throws when VTU is disabled for the merchant', async () => {
    const { supabase } = createMockSupabase({
      settings: { vtu_enabled: false },
    });

    await expect(prepareAirtime(supabase, 'MTN')).rejects.toThrow(
      'VTU is not enabled for this merchant'
    );
  });
});
