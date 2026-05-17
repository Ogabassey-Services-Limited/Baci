import { describe, expect, it } from 'vitest';
import { computeExpectedTotalDiscount } from './expected-total-discount';

describe('computeExpectedTotalDiscount', () => {
  it('returns the bounded server-side discount needed to honor an auto-negotiated total', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 1000,
      canonicalTaxAmount: 75,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 1042.75,
    });

    expect(discount).toBe(32.25);
  });

  it('keeps one-cent negotiation deltas after money rounding', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 100.005,
      canonicalTaxAmount: 0,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 99,
    });

    expect(discount).toBe(1.01);
  });

  it('rejects the prior 5% negotiation ceiling', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 780000,
      canonicalTaxAmount: 58500,
      shippingFee: 20000,
      giftWrappingFee: 0,
      expectedTotal: 826250,
    });

    expect(discount).toBe(0);
  });

  it('does not discount when the client total already matches the canonical total', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 780000,
      canonicalTaxAmount: 58500,
      shippingFee: 20000,
      giftWrappingFee: 0,
      expectedTotal: 858500,
    });

    expect(discount).toBe(0);
  });

  it('rejects totals below the automatic negotiation floor', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 850000,
      canonicalTaxAmount: 63750,
      shippingFee: 25000,
      giftWrappingFee: 0,
      expectedTotal: 831250,
    });

    expect(discount).toBe(0);
  });

  it('skips the discount when no expected total was provided', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 780000,
      canonicalTaxAmount: 58500,
      shippingFee: 20000,
      giftWrappingFee: 0,
      expectedTotal: null,
    });

    expect(discount).toBe(0);
  });
});
