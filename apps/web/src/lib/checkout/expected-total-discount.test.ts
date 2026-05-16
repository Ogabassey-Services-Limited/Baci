import { describe, expect, it } from 'vitest';
import { computeExpectedTotalDiscount } from './expected-total-discount';

describe('computeExpectedTotalDiscount', () => {
  it('returns the bounded server-side discount needed to honor an auto-negotiated total', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 780000,
      canonicalTaxAmount: 58500,
      shippingFee: 20000,
      giftWrappingFee: 0,
      expectedTotal: 826250,
    });

    expect(discount).toBe(32250);
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
