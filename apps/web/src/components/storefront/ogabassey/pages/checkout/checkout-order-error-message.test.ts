import { describe, expect, it } from 'vitest';
import {
  getCheckoutOrderErrorMessage,
  getOrderCreateErrorCode,
  isQuizVoucherRejectionCode,
} from './checkout-order-error-message';

describe('getCheckoutOrderErrorMessage', () => {
  it('maps an expired quiz voucher code to friendly copy', () => {
    const message = getCheckoutOrderErrorMessage({
      error: 'Failed to create order',
      details: 'quiz_voucher_token_expired',
    });

    expect(message).toBe('Your quiz prize voucher has expired.');
  });

  it('maps a not-approved quiz voucher code to a support-directed message', () => {
    const message = getCheckoutOrderErrorMessage({
      error: 'Failed to create order',
      details: 'quiz_voucher_award_not_approved',
    });

    expect(message).toBe(
      "This prize isn't available to redeem yet. Please contact support."
    );
  });

  it('maps an already-used voucher code to the reuse message', () => {
    const message = getCheckoutOrderErrorMessage({
      details: 'quiz_voucher_award_not_found',
    });

    expect(message).toBe(
      'This prize voucher has already been used or is no longer valid.'
    );
  });

  it('falls back to the raw code when no friendly mapping exists', () => {
    const message = getCheckoutOrderErrorMessage({
      error: 'Failed to create order',
      details: 'order_total_mismatch',
    });

    expect(message).toBe('order_total_mismatch');
  });

  it('falls back to a generic message when no code is present', () => {
    expect(getCheckoutOrderErrorMessage({})).toBe('Failed to create order');
  });
});

describe('getOrderCreateErrorCode', () => {
  it('prefers details over error', () => {
    expect(
      getOrderCreateErrorCode({ error: 'generic', details: 'specific_code' })
    ).toBe('specific_code');
  });

  it('returns null when neither field is a string', () => {
    expect(getOrderCreateErrorCode({ error: 42, details: null })).toBeNull();
  });
});

describe('isQuizVoucherRejectionCode', () => {
  it('recognizes quiz voucher rejection codes', () => {
    expect(isQuizVoucherRejectionCode('quiz_voucher_token_expired')).toBe(true);
    expect(isQuizVoucherRejectionCode('quiz_voucher_invalid')).toBe(true);
  });

  it('ignores unrelated codes and null', () => {
    expect(isQuizVoucherRejectionCode('order_total_mismatch')).toBe(false);
    expect(isQuizVoucherRejectionCode(null)).toBe(false);
  });
});
