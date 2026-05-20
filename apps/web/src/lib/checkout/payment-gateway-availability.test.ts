import { describe, expect, it } from 'vitest';
import {
  isBankTransferCheckoutAvailable,
  isKorapayCheckoutAvailable,
  isPaystackCheckoutAvailable,
} from '@/lib/checkout/payment-gateway-availability';

describe('payment-gateway-availability', () => {
  it('returns true when paystack is enabled and a subaccount exists', () => {
    const merchant = {
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: {},
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(true);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(true);
  });

  it('returns false when paystack is explicitly disabled', () => {
    const merchant = {
      paystack_subaccount_code: 'ACCT_123',
      feature_settings: { paystack_enabled: false },
    };

    expect(isPaystackCheckoutAvailable(merchant)).toBe(false);
    expect(isBankTransferCheckoutAvailable(merchant)).toBe(false);
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

  it('returns false for Korapay when not explicitly enabled', () => {
    expect(
      isKorapayCheckoutAvailable({
        feature_settings: {},
      })
    ).toBe(false);
  });

  it('returns true for Korapay when explicitly enabled', () => {
    expect(
      isKorapayCheckoutAvailable({
        feature_settings: { korapay_enabled: true },
      })
    ).toBe(true);
  });

  it('returns false for Korapay when explicitly disabled', () => {
    expect(
      isKorapayCheckoutAvailable({
        feature_settings: { korapay_enabled: false },
      })
    ).toBe(false);
  });
});
