import { jest } from '@jest/globals';
import {
  DEFAULT_FALLBACK_VAT_RATE_PERCENT,
  FALLBACK_VAT_RATE_ENV,
} from '@/constants/tax';
import {
  getEnabledPaymentMethods,
  getMerchantTaxRate,
  normalizePaymentSettings,
} from './useMerchantPaymentSettings';

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

describe('normalizePaymentSettings', () => {
  const originalFallbackVatRate = process.env[FALLBACK_VAT_RATE_ENV];

  afterEach(() => {
    if (originalFallbackVatRate === undefined) {
      delete process.env[FALLBACK_VAT_RATE_ENV];
    } else {
      process.env[FALLBACK_VAT_RATE_ENV] = originalFallbackVatRate;
    }
  });

  it.each([
    null,
    undefined,
    42,
    { nested: { malformed: true } },
  ])('normalizes unavailable or malformed settings %p to safe defaults', (settings) => {
    expect(normalizePaymentSettings(settings as never)).toMatchObject({
      klump_max_amount: 0,
      klump_min_amount: 0,
      paystack_enabled: true,
      vat_rate: DEFAULT_FALLBACK_VAT_RATE_PERCENT,
      wallet_order_auto_debit_enabled: false,
      wallet_paystack_dva_enabled: false,
    });
  });

  it('normalizes missing wallet DVA fields to false during staged deploys', () => {
    expect(
      normalizePaymentSettings({
        paystack_enabled: true,
      })
    ).toMatchObject({
      paystack_enabled: true,
      wallet_order_auto_debit_enabled: false,
      wallet_paystack_dva_enabled: false,
    });
  });

  it('normalizes malformed numeric payment settings to safe defaults', () => {
    expect(
      normalizePaymentSettings({
        klump_max_amount: Number.NaN,
        klump_min_amount: 'invalid' as never,
        vat_rate: Number.POSITIVE_INFINITY,
      })
    ).toMatchObject({
      klump_max_amount: 0,
      klump_min_amount: 0,
      vat_rate: DEFAULT_FALLBACK_VAT_RATE_PERCENT,
    });
  });

  it('rejects negative VAT rates and falls back to the configured default', () => {
    expect(
      normalizePaymentSettings({
        vat_rate: -5,
      })
    ).toMatchObject({
      vat_rate: DEFAULT_FALLBACK_VAT_RATE_PERCENT,
    });
  });

  it('falls back when numeric helpers receive values that throw during parsing', () => {
    const throwingValue = {
      valueOf() {
        throw new Error('cannot coerce');
      },
    };

    expect(
      normalizePaymentSettings({
        klump_min_amount: throwingValue as never,
        vat_rate: throwingValue as never,
      })
    ).toMatchObject({
      klump_min_amount: 0,
      vat_rate: DEFAULT_FALLBACK_VAT_RATE_PERCENT,
    });
  });

  it('reads fallback VAT lazily so tests and runtime config can set it before normalization', () => {
    process.env[FALLBACK_VAT_RATE_ENV] = '5';

    expect(normalizePaymentSettings(null).vat_rate).toBe(5);
    expect(
      getMerchantTaxRate({
        ...normalizePaymentSettings(null),
        vat_registration_status: 'registered',
        vat_rate: undefined as never,
      })
    ).toBe(0.05);
  });

  it('keeps bank transfer enabled by Paystack while exposing wallet auto-debit flags separately', () => {
    const settings = normalizePaymentSettings({
      paystack_enabled: true,
      wallet_order_auto_debit_enabled: true,
      wallet_paystack_dva_enabled: true,
    });

    expect(getEnabledPaymentMethods(settings)).toContain('bank_transfer');
    expect(settings.wallet_order_auto_debit_enabled).toBe(true);
    expect(settings.wallet_paystack_dva_enabled).toBe(true);
  });
});
