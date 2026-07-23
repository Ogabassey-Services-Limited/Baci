import { describe, expect, it } from 'vitest';
import {
  CANCELLED_PAYMENT_STATUSES,
  isCancelledPaymentStatus,
  isNonPayablePaymentStatus,
  NON_PAYABLE_PAYMENT_STATUSES,
} from './non-payable-payment-statuses';

describe('NON_PAYABLE_PAYMENT_STATUSES', () => {
  it('includes bnpl_approved — the omission that let PayPal double-charge a financed order', () => {
    // The PayPal capture resolver kept a private copy of this list without
    // bnpl_approved, so it read a BNPL-approved order as plainly unpaid and
    // captured it: the buyer owed the lender AND was charged again on PayPal.
    expect(isNonPayablePaymentStatus('bnpl_approved')).toBe(true);
  });

  it.each(['paid', 'partially_paid', 'refunded'])(
    'treats %s as non-payable',
    (status) => {
      expect(isNonPayablePaymentStatus(status)).toBe(true);
    }
  );

  it.each(['unpaid', 'pending', null, undefined, ''])(
    'leaves %s payable',
    (status) => {
      expect(isNonPayablePaymentStatus(status)).toBe(false);
    }
  );

  it('does NOT include cancellation states — those must be clamped/refunded, not merely blocked', () => {
    // Routing a cancelled order through the "already settled" branch would block
    // without returning the buyer's captured money.
    expect(NON_PAYABLE_PAYMENT_STATUSES.has('cancelled')).toBe(false);
    expect(NON_PAYABLE_PAYMENT_STATUSES.has('expired')).toBe(false);
  });
});

describe('CANCELLED_PAYMENT_STATUSES', () => {
  it.each(['cancelled', 'expired'])(
    'treats %s as a dead checkout',
    (status) => {
      expect(isCancelledPaymentStatus(status)).toBe(true);
    }
  );

  it.each(['unpaid', 'paid', 'bnpl_approved', null, undefined])(
    'does not treat %s as cancelled',
    (status) => {
      expect(isCancelledPaymentStatus(status)).toBe(false);
    }
  );

  it('exposes exactly the two dead-checkout states', () => {
    expect([...CANCELLED_PAYMENT_STATUSES].sort()).toEqual([
      'cancelled',
      'expired',
    ]);
  });
});
