import { getBillPaymentAmountError } from './bill-payment-amount-validation';

describe('getBillPaymentAmountError', () => {
  it('rejects non-finite amounts', () => {
    expect(getBillPaymentAmountError(Number.NaN, null)).toBe(
      'Please enter a valid amount.'
    );
    expect(getBillPaymentAmountError(Number.POSITIVE_INFINITY, null)).toBe(
      'Please enter a valid amount.'
    );
    expect(getBillPaymentAmountError(Number.NEGATIVE_INFINITY, null)).toBe(
      'Please enter a valid amount.'
    );
  });

  it('rejects zero amounts', () => {
    expect(getBillPaymentAmountError(0, null)).toBe(
      'Amount must be between ₦50 and ₦500,000.'
    );
  });

  it('rejects amounts below the generic floor', () => {
    expect(getBillPaymentAmountError(49, null)).toBe(
      'Amount must be between ₦50 and ₦500,000.'
    );
  });

  it('rejects amounts below the provider minimum', () => {
    expect(getBillPaymentAmountError(99, { minAmount: 100 })).toBe(
      'Minimum amount for this product is ₦100.'
    );
  });

  it('rejects amounts above the provider maximum', () => {
    expect(getBillPaymentAmountError(50_001, { maxAmount: 50_000 })).toBe(
      'Maximum amount for this product is ₦50,000.'
    );
  });

  it('returns null for an accepted amount', () => {
    expect(
      getBillPaymentAmountError(1000, { maxAmount: 50_000, minAmount: 100 })
    ).toBeNull();
  });

  it('accepts amounts exactly at generic and provider boundaries', () => {
    expect(getBillPaymentAmountError(50, null)).toBeNull();
    expect(getBillPaymentAmountError(500_000, null)).toBeNull();
    expect(getBillPaymentAmountError(100, { minAmount: 100 })).toBeNull();
    expect(getBillPaymentAmountError(50_000, { maxAmount: 50_000 })).toBeNull();
  });
});
