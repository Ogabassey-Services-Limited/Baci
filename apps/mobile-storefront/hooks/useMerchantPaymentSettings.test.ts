import { getEnabledPaymentMethods } from './useMerchantPaymentSettings';

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      merchantId: 'merchant-test-id',
    },
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('getEnabledPaymentMethods', () => {
  it('keeps the safe fallback when payment settings are unavailable', () => {
    expect(getEnabledPaymentMethods(undefined)).toEqual([
      'paystack',
      'bank_transfer',
    ]);
  });

  it('includes Klump only when the merchant has explicitly enabled it', () => {
    const methods = getEnabledPaymentMethods({
      paystack_enabled: true,
      korapay_enabled: false,
      juicyway_enabled: false,
      pay_on_delivery_enabled: false,
      credpal_enabled: false,
      credit_direct_enabled: false,
      klump_enabled: true,
    } as never);

    expect(methods).toEqual(['paystack', 'klump', 'bank_transfer']);
  });
});
