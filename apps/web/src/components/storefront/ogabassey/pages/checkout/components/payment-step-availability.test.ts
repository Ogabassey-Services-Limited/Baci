import { describe, expect, it } from 'vitest';
import {
  hasAnyInstallmentOption,
  isKlumpEligible,
  isPaymentMethodAvailable,
} from './payment-step-availability';

describe('payment-step availability helpers', () => {
  it('requires enabled NGN Klump payments with matching payable amount', () => {
    expect(
      isKlumpEligible({
        featureSettings: { klump_enabled: true },
        currency: 'NGN',
        orderAmount: 50_000,
        payableAmount: 50_000,
      }),
    ).toBe(true);
    expect(
      isKlumpEligible({
        featureSettings: { klump_enabled: true },
        currency: null,
        orderAmount: 50_000,
        payableAmount: 50_000,
      }),
    ).toBe(false);
    expect(
      isKlumpEligible({
        featureSettings: { klump_enabled: true },
        currency: 'NGN',
        orderAmount: 50_000,
        payableAmount: 45_000,
      }),
    ).toBe(false);
  });

  it('falls back empty Klump limits to the default eligibility bounds', () => {
    expect(
      isKlumpEligible({
        featureSettings: {
          klump_enabled: true,
          klump_min_amount: '',
          klump_max_amount: '   ',
        },
        currency: 'ngn',
        orderAmount: 1_000_000,
        payableAmount: 1_000_000,
      }),
    ).toBe(true);
  });

  it('hides Klump above the default one million naira limit', () => {
    expect(
      isKlumpEligible({
        featureSettings: {
          klump_enabled: true,
          klump_min_amount: '',
          klump_max_amount: null,
        },
        currency: 'NGN',
        orderAmount: 1_000_001,
        payableAmount: 1_000_001,
      }),
    ).toBe(false);
  });

  it('checks selected payment method and installment availability', () => {
    const featureSettings = {
      credit_direct_enabled: true,
      klump_enabled: true,
    };

    expect(
      isPaymentMethodAvailable({
        paymentMethod: 'klump',
        paystackCheckoutAvailable: false,
        korapayCheckoutAvailable: false,
        bankTransferCheckoutAvailable: false,
        featureSettings,
        currency: 'NGN',
        orderAmount: 50_000,
        payableAmount: 50_000,
      }),
    ).toBe(true);
    expect(
      hasAnyInstallmentOption({
        featureSettings,
        currency: 'NGN',
        orderAmount: 50_000,
        payableAmount: 50_000,
      }),
    ).toBe(true);
  });
});
