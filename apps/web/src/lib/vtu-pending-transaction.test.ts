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
    vi.clearAllMocks();
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

  it('persists customerName from the input as the row customer_name', async () => {
    const { insert, supabase } = createMockSupabase();

    await preparePendingVtuTransaction({
      supabase,
      user: {
        id: 'user-1',
        email: 'customer@example.com',
      } as unknown as Parameters<
        typeof preparePendingVtuTransaction
      >[0]['user'],
      input: {
        merchantSlug: 'ogabassey',
        type: 'electricity',
        amount: 2000,
        billerName: 'EKEDC NG',
        billItemIdentifier: 'KUD-ELE-EKED-001',
        customerIdentifier: '43901766923',
        customerName: 'JANE METER-OWNER',
        source: 'checkout',
      } as unknown as Parameters<
        typeof preparePendingVtuTransaction
      >[0]['input'],
      source: 'checkout',
      requireCustomer: true,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_name: 'JANE METER-OWNER' })
    );
  });

  it('stores the real buyer phone on non-telco VTU rows and keeps the meter as customer_identifier', async () => {
    const { insert, supabase } = createMockSupabase();

    await preparePendingVtuTransaction({
      supabase,
      user: {
        id: 'user-1',
        email: 'customer@example.com',
      } as unknown as Parameters<
        typeof preparePendingVtuTransaction
      >[0]['user'],
      input: {
        merchantSlug: 'ogabassey',
        type: 'electricity',
        amount: 1000,
        billerName: 'EKEDC NG',
        billItemIdentifier: 'KUD-ELE-EKED-002',
        customerIdentifier: '43901766923',
        customerPhone: '08146978921',
        source: 'checkout',
      } as unknown as Parameters<
        typeof preparePendingVtuTransaction
      >[0]['input'],
      source: 'checkout',
      requireCustomer: true,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_identifier: '43901766923',
        phone_number: '08146978921',
        metadata: expect.objectContaining({
          customerPhone: '08146978921',
        }),
      })
    );
  });

  it('falls back to null customer_name when input has none', async () => {
    const { insert, supabase } = createMockSupabase();

    await prepareAirtime(supabase);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_name: null })
    );
  });

  describe('paymentSplit metadata (Phase B.4)', () => {
    // Phase B.4 contract: when walletAmount > 0, write
    //   metadata.paymentSplit = { wallet: walletAmount, card: amount - walletAmount }
    // INCLUDING the wallet-only case (walletAmount === amount → card: 0).
    // Phase B.5's debit hook gates on `paymentSplit.wallet > 0`, so
    // wallet-only flows MUST set the field to trigger the debit.
    function prepareWithWalletAmount(
      supabase: PrepareSupabase,
      walletAmount: number | undefined
    ) {
      return preparePendingVtuTransaction({
        supabase,
        user: {
          id: 'user-1',
          email: 'customer@example.com',
        } as unknown as Parameters<
          typeof preparePendingVtuTransaction
        >[0]['user'],
        input: {
          merchantSlug: 'ogabassey',
          type: 'airtime',
          amount: 1000,
          phoneNumber: '08012345678',
          networkProvider: 'mtn',
          source: 'checkout',
          ...(walletAmount !== undefined && { walletAmount }),
        },
        source: 'checkout',
        requireCustomer: true,
      });
    }

    it('writes paymentSplit { wallet, card } for hybrid (0 < walletAmount < amount)', async () => {
      const { insert, supabase } = createMockSupabase();
      await prepareWithWalletAmount(supabase, 300);

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            paymentSplit: { wallet: 300, card: 700 },
          }),
        })
      );
    });

    it('writes paymentSplit { wallet: amount, card: 0 } for wallet-only coverage', async () => {
      // Critical for Phase B.5: fulfillment gates the wallet debit on
      // paymentSplit.wallet > 0. Wallet-only must still write the field so
      // the debit fires.
      const { insert, supabase } = createMockSupabase();
      await prepareWithWalletAmount(supabase, 1000);

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            paymentSplit: { wallet: 1000, card: 0 },
          }),
        })
      );
    });

    it('does NOT write paymentSplit when walletAmount is 0 or absent (card-only)', async () => {
      const { insert, supabase } = createMockSupabase();
      await prepareWithWalletAmount(supabase, undefined);

      const insertCall = insert.mock.calls[0]?.[0] as
        | { metadata?: Record<string, unknown> }
        | undefined;
      expect(insertCall?.metadata).not.toHaveProperty('paymentSplit');

      insert.mockClear();
      await prepareWithWalletAmount(supabase, 0);
      const zeroCall = insert.mock.calls[0]?.[0] as
        | { metadata?: Record<string, unknown> }
        | undefined;
      expect(zeroCall?.metadata).not.toHaveProperty('paymentSplit');
    });

    it('does NOT write paymentSplit for non-checkout sources even when walletAmount > 0', async () => {
      // Defense in depth alongside the schema check. The schema
      // already rejects walletAmount > 0 on non-checkout sources at
      // the API boundary, but the prepare step also gates the
      // metadata write so a bypass (manual SQL, future code path) can
      // never strand a wallet debit on a non-checkout row.
      const { insert, supabase } = createMockSupabase();
      await preparePendingVtuTransaction({
        supabase,
        user: {
          id: 'user-1',
          email: 'customer@example.com',
        } as unknown as Parameters<
          typeof preparePendingVtuTransaction
        >[0]['user'],
        input: {
          merchantSlug: 'ogabassey',
          type: 'airtime',
          amount: 1000,
          phoneNumber: '08012345678',
          networkProvider: 'mtn',
          source: 'loyalty_reward',
          walletAmount: 1000,
        },
        source: 'loyalty_reward',
        requireCustomer: true,
      });
      const insertCall = insert.mock.calls[0]?.[0] as
        | { metadata?: Record<string, unknown> }
        | undefined;
      expect(insertCall?.metadata).not.toHaveProperty('paymentSplit');
    });
  });
});
