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

  it('maps a pre-RPC uppercase code (in `code`, no `details`) to friendly copy', () => {
    // Token-expiry and other pre-RPC rejections arrive as { code, error } with
    // no `details` field — the common real-world case.
    const message = getCheckoutOrderErrorMessage({
      code: 'QUIZ_VOUCHER_TOKEN_EXPIRED',
      error: 'Quiz voucher token has expired',
    });

    expect(message).toBe('Your quiz prize voucher has expired.');
  });

  it('prefers the human error over a bare machine code when unmapped', () => {
    // e.g. CHECKOUT_ORDER_NOT_REUSABLE ships a readable `error` but no `details`
    // — the shopper should see the sentence, not the enum.
    const message = getCheckoutOrderErrorMessage({
      code: 'CHECKOUT_ORDER_NOT_REUSABLE',
      error: 'This order can no longer be reused. Please start a new checkout.',
    });

    expect(message).toBe(
      'This order can no longer be reused. Please start a new checkout.'
    );
  });
});

describe('getOrderCreateErrorCode', () => {
  it('prefers details over error', () => {
    expect(
      getOrderCreateErrorCode({ error: 'generic', details: 'specific_code' })
    ).toBe('specific_code');
  });

  it('falls back to the `code` field when there is no `details`', () => {
    expect(
      getOrderCreateErrorCode({
        code: 'QUIZ_VOUCHER_TOKEN_EXPIRED',
        error: 'human string',
      })
    ).toBe('QUIZ_VOUCHER_TOKEN_EXPIRED');
  });

  it('returns null when no field is a string', () => {
    expect(
      getOrderCreateErrorCode({ error: 42, details: null, code: undefined })
    ).toBeNull();
  });
});

describe('isQuizVoucherRejectionCode', () => {
  it('recognizes quiz voucher rejection codes (case-insensitive)', () => {
    expect(isQuizVoucherRejectionCode('quiz_voucher_token_expired')).toBe(true);
    expect(isQuizVoucherRejectionCode('quiz_voucher_invalid')).toBe(true);
    // Pre-RPC codes arrive uppercase.
    expect(isQuizVoucherRejectionCode('QUIZ_VOUCHER_TOKEN_EXPIRED')).toBe(true);
    expect(isQuizVoucherRejectionCode('QUIZ_VOUCHER_TOKEN_INVALID')).toBe(true);
  });

  it('does NOT prune a sign-in-required rejection (voucher still valid)', () => {
    expect(isQuizVoucherRejectionCode('QUIZ_VOUCHER_AUTH_REQUIRED')).toBe(false);
    expect(isQuizVoucherRejectionCode('quiz_voucher_user_required')).toBe(false);
  });

  it('ignores unrelated codes and null', () => {
    expect(isQuizVoucherRejectionCode('order_total_mismatch')).toBe(false);
    expect(isQuizVoucherRejectionCode(null)).toBe(false);
  });
});
