import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
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
  let warnSpy: MockInstance | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore only the console spy created within individual tests; the
    // hoisted vi.fn() mocks above are intentionally left alone (their default
    // implementations are reused across tests via mockResolvedValueOnce).
    if (warnSpy) {
      warnSpy.mockRestore();
      warnSpy = null;
    }
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

  it('warns when commission rate is exactly 1 (ambiguous value-1 case)', async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 1 },
    });

    await prepareAirtime(supabase);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('value-1 case'),
      expect.objectContaining({ rawValue: 1, merchantId: 'merchant-1' })
    );
  });

  it('treats fractional commission rate of 1.5 as 1.5%', async () => {
    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 1.5 },
    });

    await prepareAirtime(supabase);

    expect(mockCalculateCommerce).toHaveBeenLastCalledWith(
      'calculate_vtu',
      expect.objectContaining({ merchantSplit: 1.5 })
    );
  });

  it('does not warn for fractional rate of 0.5', async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 0.5 },
    });

    await prepareAirtime(supabase);

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('value-1 case'),
      expect.anything()
    );
  });

  it('does not warn for whole-number rate of 50', async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 50 },
    });

    await prepareAirtime(supabase);

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('value-1 case'),
      expect.anything()
    );
  });

  it('treats commission rate of 1 as 100% (not 1%)', async () => {
    // A stored merchant commission of `1` should mean "full commission"
    // (100%), matching how `100` is interpreted. Without the (0, 1] fix this
    // would be treated as 1% and merchantSplit would land at 1.
    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase: fractionalSupabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 1 },
    });
    const fractionalResult = await prepareAirtime(fractionalSupabase);

    expect(mockCalculateCommerce).toHaveBeenLastCalledWith(
      'calculate_vtu',
      expect.objectContaining({ merchantSplit: 100 })
    );

    mockCalculateCommerce.mockResolvedValueOnce({
      merchantEarning: 10,
      platformEarning: 5,
    });
    const { supabase: percentSupabase } = createMockSupabase({
      settings: { vtu_merchant_commission_rate: 100 },
    });
    const percentResult = await prepareAirtime(percentSupabase);

    expect(mockCalculateCommerce).toHaveBeenLastCalledWith(
      'calculate_vtu',
      expect.objectContaining({ merchantSplit: 100 })
    );
    expect(fractionalResult.effectiveMerchantEarning).toBe(
      percentResult.effectiveMerchantEarning
    );
  });
});
