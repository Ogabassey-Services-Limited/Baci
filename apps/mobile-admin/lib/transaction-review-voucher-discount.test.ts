import { describe, expect, it } from 'vitest';
import { getQuizVoucherDiscountAmount } from './transaction-review-voucher-discount';

describe('getQuizVoucherDiscountAmount', () => {
  it('sums merchandise totals for voucher-awarded lines', () => {
    const amount = getQuizVoucherDiscountAmount([
      { price: 100, quantity: 2, quiz_award_id: 'award-1' },
      { price: 50, quantity: 1 },
      { price: 25, quantity: null, quiz_award_id: 'award-2' },
    ]);

    expect(amount).toBe(225);
  });

  it('ignores malformed voucher lines and clamps negative values', () => {
    const amount = getQuizVoucherDiscountAmount([
      { price: 'invalid', quantity: 2, quiz_award_id: 'award-1' },
      { price: -50, quantity: 1, quiz_award_id: 'award-2' },
      { price: 100, quantity: -2, quiz_award_id: 'award-3' },
      { price: 100, quantity: 1, quiz_award_id: ' ' },
    ]);

    expect(amount).toBe(0);
  });

  it('uses the persisted award amount when the catalog price changes', () => {
    const amount = getQuizVoucherDiscountAmount([
      {
        price: 120,
        quantity: 1,
        quiz_award_id: 'award-1',
        quiz_award_amount: 100,
      },
    ]);

    expect(amount).toBe(100);
  });
});
