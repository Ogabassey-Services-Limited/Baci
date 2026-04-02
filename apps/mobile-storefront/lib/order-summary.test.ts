import {
  getOrderAssuranceFeeTotal,
  getOrderDisplayTotal,
  getOrderSummaryBreakdown,
} from './order-summary';

describe('order summary helpers', () => {
  it('uses item assurance fees when present', () => {
    expect(
      getOrderAssuranceFeeTotal([
        { assurance_fee: 1200 },
        { assurance_fee: 800 },
      ])
    ).toBe(2000);
  });

  it('sums only defined assurance fees across mixed items', () => {
    expect(
      getOrderAssuranceFeeTotal([
        { assurance_fee: 1000 },
        {},
        { assurance_fee: 500 },
      ])
    ).toBe(1500);
  });

  it('falls back to insurance premium when items do not expose assurance fees', () => {
    expect(getOrderAssuranceFeeTotal([], 3500)).toBe(3500);
  });

  it('keeps the stored total when it already includes tax', () => {
    expect(
      getOrderDisplayTotal({
        subtotal: 100000,
        shippingFee: 5000,
        taxAmount: 7500,
        discountAmount: 0,
        total: 112500,
        paymentStatus: 'pending',
      })
    ).toBe(112500);
  });

  it('repairs legacy pending totals that excluded tax', () => {
    expect(
      getOrderDisplayTotal({
        subtotal: 100000,
        shippingFee: 5000,
        taxAmount: 7500,
        discountAmount: 0,
        total: 105000,
        paymentStatus: 'pending',
      })
    ).toBe(112500);
  });

  it('does not rewrite settled orders even if their stored total excluded tax', () => {
    expect(
      getOrderDisplayTotal({
        subtotal: 100000,
        shippingFee: 5000,
        taxAmount: 7500,
        discountAmount: 0,
        total: 105000,
        paymentStatus: 'paid',
      })
    ).toBe(105000);
  });

  it('separates assurance from subtotal for display breakdown', () => {
    expect(
      getOrderSummaryBreakdown({
        subtotal: 105000,
        shippingFee: 5000,
        taxAmount: 7500,
        discountAmount: 0,
        total: 117500,
        assuranceFee: 5000,
      })
    ).toEqual({
      itemsSubtotal: 100000,
      assuranceFee: 5000,
      shippingFee: 5000,
      taxAmount: 7500,
      discountAmount: 0,
      total: 117500,
    });
  });

  it('preserves zero assurance fees in the display breakdown', () => {
    expect(
      getOrderSummaryBreakdown({
        subtotal: 100000,
        shippingFee: 5000,
        taxAmount: 7500,
        discountAmount: 0,
        total: 112500,
        assuranceFee: 0,
      })
    ).toEqual({
      itemsSubtotal: 100000,
      assuranceFee: 0,
      shippingFee: 5000,
      taxAmount: 7500,
      discountAmount: 0,
      total: 112500,
    });
  });
});
