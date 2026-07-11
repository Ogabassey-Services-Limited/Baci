import { describe, expect, it } from 'vitest';
import { selectRejectedVoucherLines } from './select-rejected-voucher-lines';

interface TestLine {
  id: string;
  quizVoucherToken?: string | null;
  quizAwardId?: string | null;
}

const validVoucher: TestLine = {
  id: 'line-valid',
  quizAwardId: 'award-valid',
  quizVoucherToken: 'qv1.valid',
};
const expiredVoucher: TestLine = {
  id: 'line-expired',
  quizAwardId: 'award-expired',
  quizVoucherToken: 'qv1.expired',
};
const plainProduct: TestLine = { id: 'line-plain' };

describe('selectRejectedVoucherLines', () => {
  it('returns nothing when the error is not a voucher rejection', () => {
    expect(
      selectRejectedVoucherLines([validVoucher, plainProduct], {
        code: 'CHECKOUT_ORDER_NOT_REUSABLE',
        error: 'Please refresh and try again',
      })
    ).toEqual([]);
  });

  it('prunes only the token the server identified, keeping other valid vouchers', () => {
    // Multi-voucher cart: only the expired token is rejected, so the valid
    // prize line must survive.
    const result = selectRejectedVoucherLines(
      [validVoucher, expiredVoucher, plainProduct],
      {
        code: 'QUIZ_VOUCHER_TOKEN_EXPIRED',
        error: 'Quiz voucher token has expired',
        rejectedVoucherToken: 'qv1.expired',
      }
    );

    expect(result).toEqual([expiredVoucher]);
  });

  it('prunes the single voucher line when the server did not identify one', () => {
    const result = selectRejectedVoucherLines([validVoucher, plainProduct], {
      code: 'QUIZ_VOUCHER_AWARD_NOT_FOUND',
      error: 'This prize voucher has already been used or is no longer valid.',
    });

    expect(result).toEqual([validVoucher]);
  });

  it('prunes nothing from a multi-voucher cart when no token is identified', () => {
    // Without a specific rejected token we cannot tell which line failed, so
    // discarding valid prizes is worse than leaving them for manual removal.
    const result = selectRejectedVoucherLines([validVoucher, expiredVoucher], {
      code: 'QUIZ_VOUCHER_TOKEN_INVALID',
      error: 'Invalid quiz voucher token',
    });

    expect(result).toEqual([]);
  });

  it('reads the rejection code from the details field before the human error', () => {
    const result = selectRejectedVoucherLines([expiredVoucher], {
      details: 'quiz_voucher_invalid',
      error: 'This prize voucher has already been used or is no longer valid.',
    });

    expect(result).toEqual([expiredVoucher]);
  });
});
