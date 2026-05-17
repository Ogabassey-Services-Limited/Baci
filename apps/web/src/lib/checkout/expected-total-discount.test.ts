import { describe, expect, it } from 'vitest';
import {
  computeExpectedTotalDiscount,
  hasExpectedTotalMismatch,
} from './expected-total-discount';

type MoneyInputName =
  | 'canonicalSubtotal'
  | 'canonicalTaxAmount'
  | 'shippingFee'
  | 'giftWrappingFee';

const baseDiscountInput = {
  canonicalSubtotal: 1000,
  canonicalTaxAmount: 75,
  shippingFee: 0,
  giftWrappingFee: 0,
  expectedTotal: 1045,
};

function inputWithMoneyValue(parameterName: MoneyInputName, value: unknown) {
  return {
    ...baseDiscountInput,
    [parameterName]: value as number,
  };
}

describe('computeExpectedTotalDiscount', () => {
  it('returns the bounded server-side discount needed to honor an auto-negotiated total', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 1000,
      canonicalTaxAmount: 75,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 1045,
    });

    expect(discount).toBe(30);
  });

  it('rejects negotiated totals that require more than 3% off subtotal-plus-tax', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 1000,
      canonicalTaxAmount: 75,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 1041.99,
    });

    expect(discount).toBe(0);
  });

  it('accepts VAT-adjusted totals for valid 3% negotiated offers', () => {
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

  it('rejects crafted low-value totals that exceed the 3% cap by less than naira tolerance', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 20,
      canonicalTaxAmount: 0,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 18.9,
    });

    expect(discount).toBe(0);
  });

  it('keeps positive ≤ ₦1 negotiated discounts instead of dropping them', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 34,
      canonicalTaxAmount: 0,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 33,
    });

    expect(discount).toBe(1);
  });

  it('accepts whole-naira rounded 3% counter-offers for normal checkout subtotals', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 1001,
      canonicalTaxAmount: 0,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 970,
    });

    expect(discount).toBe(31);
  });

  it('rejects rounded-over-cap low-subtotal counter-offers beyond the ₦1 tolerance', () => {
    const discount = computeExpectedTotalDiscount({
      canonicalSubtotal: 20,
      canonicalTaxAmount: 0,
      shippingFee: 0,
      giftWrappingFee: 0,
      expectedTotal: 18,
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

  it.each([
    ['canonicalSubtotal', Number.NaN],
    ['canonicalTaxAmount', Number.POSITIVE_INFINITY],
    ['shippingFee', '0'],
    ['giftWrappingFee', null],
  ] satisfies [
    MoneyInputName,
    unknown,
  ][])('throws TypeError when %s is not a finite number', (parameterName, value) => {
    const computeDiscount = () =>
      computeExpectedTotalDiscount(inputWithMoneyValue(parameterName, value));

    expect(computeDiscount).toThrow(TypeError);
    expect(computeDiscount).toThrow(parameterName);
  });

  it.each([
    ['canonicalSubtotal', -1],
    ['canonicalTaxAmount', -0.01],
    ['shippingFee', -1],
    ['giftWrappingFee', -1],
  ] satisfies [
    MoneyInputName,
    number,
  ][])('throws RangeError when %s is negative', (parameterName, value) => {
    const computeDiscount = () =>
      computeExpectedTotalDiscount(inputWithMoneyValue(parameterName, value));

    expect(computeDiscount).toThrow(RangeError);
    expect(computeDiscount).toThrow(parameterName);
  });
});

describe('hasExpectedTotalMismatch', () => {
  it('reports expected totals that drift beyond the parity tolerance', () => {
    expect(
      hasExpectedTotalMismatch({
        canonicalSubtotal: 1000,
        canonicalTaxAmount: 75,
        shippingFee: 0,
        giftWrappingFee: 0,
        expectedTotal: 1042.75,
      })
    ).toBe(true);
  });

  it('ignores expected totals within the parity tolerance', () => {
    expect(
      hasExpectedTotalMismatch({
        canonicalSubtotal: 1000,
        canonicalTaxAmount: 75,
        shippingFee: 0,
        giftWrappingFee: 0,
        expectedTotal: 1074,
      })
    ).toBe(false);
  });
});
