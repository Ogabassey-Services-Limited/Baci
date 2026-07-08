import { describe, expect, it } from 'vitest';
import {
  hasLaunchablePaymentMethod,
  isBankTransferCheckoutAvailable,
  isForcedGatewayAvailable,
  isKorapayCheckoutAvailable,
  isKorapayCheckoutCurrencySupported,
  isPayOnDeliveryCheckoutAvailable,
  isPaystackCheckoutAvailable,
} from '@/lib/checkout/payment-gateway-availability';

describe('payment-gateway-availability', () => {
  it('returns true when paystack is enabled and a subaccount exists', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: {},
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(true);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('treats the snapshot paystack_subaccount_configured hint as subaccount presence', () => {
    // Public snapshot merchants carry a derived boolean instead of the raw
    // subaccount code, which never crosses the anonymous boundary.
    const merchant = {
      country: 'NG',
      paystack_subaccount_configured: true,
      feature_settings: {
        paystack_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(true);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(true);
  });

  it('does not surface paystack when the hint is false and no raw code exists', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_configured: false,
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns true for bank transfer only when Paystack DVA is explicitly enabled', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: {
        paystack_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(true);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(true);
  });

  it('returns false for Paystack when the merchant country is explicitly unsupported', () => {
    const merchant = {
      country: 'IN',
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns false when paystack is explicitly disabled', () => {
    const merchant = {
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: { paystack_enabled: false },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('normalizes embedded feature settings arrays before reading payment flags', () => {
    const merchant = {
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: [
        {
          korapay_enabled: true,
          pay_on_delivery_enabled: true,
          paystack_enabled: false,
          wallet_paystack_dva_enabled: true,
        },
      ],
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
    expect(isKorapayCheckoutAvailable(merchant)).toBe(true);
    expect(isPayOnDeliveryCheckoutAvailable(merchant)).toBe(true);
  });

  it('returns false when no paystack subaccount exists', () => {
    const merchant = {
      paystack_subaccount_code: null,
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns false when the paystack subaccount only contains whitespace', () => {
    const merchant = {
      paystack_subaccount_code: '   ',
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns false when the paystack subaccount is an empty string', () => {
    const merchant = {
      paystack_subaccount_code: '',
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns false when the paystack subaccount is undefined', () => {
    const merchant = {
      paystack_subaccount_code: undefined,
      feature_settings: { paystack_enabled: true },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
  });

  it('returns false when merchant data is missing', () => {
    expect(isPaystackCheckoutAvailable(null)).toBe(false);
    expect(isPaystackCheckoutAvailable(undefined)).toBe(false);
    expect(isBankTransferCheckoutAvailable(null)).toBe(false);
    expect(isBankTransferCheckoutAvailable(undefined)).toBe(false);
    expect(isKorapayCheckoutAvailable(null)).toBe(false);
    expect(isKorapayCheckoutAvailable(undefined)).toBe(false);
  });

  it('defaults Korapay on for a supported country when the flag is unset', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: {},
        },
        'NG'
      )
    ).toBe(true);
  });

  it('keeps Korapay available for an NG merchant when explicitly enabled', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: true },
        },
        'NG'
      )
    ).toBe(true);
  });

  it('treats a null or undefined country as NG so NG merchants keep working', () => {
    const merchant = { feature_settings: { korapay_enabled: true } };

    expect(isKorapayCheckoutAvailable(merchant, null)).toBe(true);
    expect(isKorapayCheckoutAvailable(merchant, undefined)).toBe(true);
    expect(isKorapayCheckoutAvailable(merchant)).toBe(true);
  });

  it('returns true for a KE merchant when the order currency is KES', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: true },
        },
        'KE',
        'KES'
      )
    ).toBe(true);
  });

  it('returns false for a KE merchant when the order currency is NGN', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: true },
        },
        'KE',
        'NGN'
      )
    ).toBe(false);
  });

  it('returns false for a merchant in an unsupported country (US)', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: true },
        },
        'US'
      )
    ).toBe(false);
  });

  it('returns false for Korapay when the order currency does not match the country', () => {
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: true },
        },
        'NG',
        'INR'
      )
    ).toBe(false);
  });

  it('accepts Korapay checkout currencies case-insensitively', () => {
    expect(isKorapayCheckoutCurrencySupported(' ghs ')).toBe(true);
    expect(isKorapayCheckoutCurrencySupported('INR')).toBe(false);
    expect(isKorapayCheckoutCurrencySupported(null)).toBe(false);
  });

  it('returns false for Korapay when explicitly disabled, even for a supported country', () => {
    expect(
      isKorapayCheckoutAvailable({
        feature_settings: { korapay_enabled: false },
      })
    ).toBe(false);
    expect(
      isKorapayCheckoutAvailable(
        {
          feature_settings: { korapay_enabled: false },
        },
        'KE',
        'KES'
      )
    ).toBe(false);
  });

  it('returns true for Pay on Delivery when explicitly enabled', () => {
    expect(
      isPayOnDeliveryCheckoutAvailable({
        feature_settings: { pay_on_delivery_enabled: true },
      })
    ).toBe(true);
  });

  it('returns false for Pay on Delivery when disabled or missing', () => {
    expect(
      isPayOnDeliveryCheckoutAvailable({
        feature_settings: { pay_on_delivery_enabled: false },
      })
    ).toBe(false);
    expect(isPayOnDeliveryCheckoutAvailable({})).toBe(false);
  });

  it('treats India Pay on Delivery as a launchable payment method without Paystack bank details', () => {
    expect(
      hasLaunchablePaymentMethod({
        country: 'IN',
        bank_account_number: null,
        bank_code: null,
        paystack_subaccount_code: null,
        feature_settings: {
          pay_on_delivery_enabled: true,
          paystack_enabled: false,
        },
      })
    ).toBe(true);
  });

  it('does not treat India as launchable when Pay on Delivery is disabled and Paystack details are missing', () => {
    expect(
      hasLaunchablePaymentMethod({
        country: 'IN',
        bank_account_number: null,
        bank_code: null,
        paystack_subaccount_code: null,
        feature_settings: {
          pay_on_delivery_enabled: false,
          paystack_enabled: false,
        },
      })
    ).toBe(false);
  });
});

describe('isForcedGatewayAvailable', () => {
  it('allows forced paystack when enabled with a subaccount in a supported country', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: { paystack_enabled: true },
    };

    expect(isForcedGatewayAvailable('paystack', merchant, 'NGN')).toBe(true);
  });

  it('rejects forced paystack when the merchant has no subaccount', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_code: null,
      feature_settings: { paystack_enabled: true },
    };

    expect(isForcedGatewayAvailable('paystack', merchant, 'NGN')).toBe(false);
  });

  it('rejects forced paystack when paystack is explicitly disabled', () => {
    const merchant = {
      country: 'NG',
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: { paystack_enabled: false },
    };

    expect(isForcedGatewayAvailable('paystack', merchant, 'NGN')).toBe(false);
  });

  it('allows forced korapay for a supported country/currency pair', () => {
    const merchant = { feature_settings: { korapay_enabled: true } };

    expect(
      isForcedGatewayAvailable('korapay', { ...merchant, country: 'KE' }, 'KES')
    ).toBe(true);
  });

  it('rejects forced korapay when the merchant has not enabled korapay', () => {
    const merchant = {
      country: 'NG',
      feature_settings: { korapay_enabled: false },
    };

    expect(isForcedGatewayAvailable('korapay', merchant, 'NGN')).toBe(false);
  });

  it('rejects forced korapay when the order currency does not match the merchant country', () => {
    const merchant = {
      country: 'KE',
      feature_settings: { korapay_enabled: true },
    };

    expect(isForcedGatewayAvailable('korapay', merchant, 'NGN')).toBe(false);
  });

  it('allows forced BNPL gateways only when their enable flag is set', () => {
    expect(
      isForcedGatewayAvailable(
        'credit_direct',
        { feature_settings: { credit_direct_enabled: true } },
        'NGN'
      )
    ).toBe(true);
    expect(
      isForcedGatewayAvailable(
        'credpal',
        { feature_settings: { credpal_enabled: true } },
        'NGN'
      )
    ).toBe(true);
    expect(
      isForcedGatewayAvailable(
        'klump',
        { feature_settings: { klump_enabled: true } },
        'NGN'
      )
    ).toBe(true);
  });

  it('rejects forced BNPL gateways when the merchant has not enabled them', () => {
    const merchant = { feature_settings: {} };

    expect(isForcedGatewayAvailable('credit_direct', merchant, 'NGN')).toBe(
      false
    );
    expect(isForcedGatewayAvailable('credpal', merchant, 'NGN')).toBe(false);
    expect(isForcedGatewayAvailable('klump', merchant, 'NGN')).toBe(false);
  });

  it('rejects a forced BNPL gateway when merchant data is missing', () => {
    expect(isForcedGatewayAvailable('credit_direct', null, 'NGN')).toBe(false);
    expect(isForcedGatewayAvailable('credpal', undefined, 'NGN')).toBe(false);
  });

  it('defers juicyway to the platform-level env gate (always passes the merchant gate)', () => {
    expect(
      isForcedGatewayAvailable('juicyway', { feature_settings: {} }, 'NGN')
    ).toBe(true);
    expect(isForcedGatewayAvailable('juicyway', null, 'NGN')).toBe(true);
  });
});
