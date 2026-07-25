import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAYMENT_SETTINGS,
  normalizePaymentSettings,
} from './payment-settings';

describe('DEFAULT_PAYMENT_SETTINGS', () => {
  it('defaults Korapay OFF (opt-in) and Paystack ON', () => {
    expect(DEFAULT_PAYMENT_SETTINGS.korapay_enabled).toBe(false);
    expect(DEFAULT_PAYMENT_SETTINGS.paystack_enabled).toBe(true);
  });
});

describe('normalizePaymentSettings', () => {
  it('defaults Korapay OFF when the flag is null (dashboard regression)', () => {
    // The dashboard toggle must show OFF for a null/never-saved korapay_enabled,
    // matching the checkout gate — not the old default-ON behaviour.
    const result = normalizePaymentSettings({ korapay_enabled: null });
    expect(result.korapay_enabled).toBe(false);
  });

  it('defaults Korapay OFF when the flag is absent', () => {
    const result = normalizePaymentSettings({});
    expect(result.korapay_enabled).toBe(false);
    expect(result.paystack_enabled).toBe(true);
  });

  it('honours an explicit Korapay opt-in', () => {
    expect(
      normalizePaymentSettings({ korapay_enabled: true }).korapay_enabled
    ).toBe(true);
  });

  it('keeps an explicit Paystack opt-out', () => {
    expect(
      normalizePaymentSettings({ paystack_enabled: false }).paystack_enabled
    ).toBe(false);
  });

  it('falls back to valid gateways and rejects unknown values', () => {
    expect(
      normalizePaymentSettings({ preferred_local_gateway: 'korapay' })
        .preferred_local_gateway
    ).toBe('korapay');
    expect(
      normalizePaymentSettings({ preferred_local_gateway: 'unknown' })
        .preferred_local_gateway
    ).toBe('paystack');
    expect(
      normalizePaymentSettings({ preferred_international_gateway: null })
        .preferred_international_gateway
    ).toBe('korapay');
  });
});
