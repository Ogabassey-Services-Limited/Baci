import { describe, expect, it, vi } from 'vitest';
import {
  PAYPAL_AMOUNT_EPSILON,
  type PaypalCaptureState,
  resolvePaypalCaptureOutcome,
} from './paypal-capture-outcome';

vi.mock('server-only', () => ({}));

function state(overrides: Partial<PaypalCaptureState>): PaypalCaptureState {
  return {
    orderPaymentStatus: 'unpaid',
    orderShippingStatus: 'pending',
    txnStatus: 'pending',
    paypalOrderStatus: 'APPROVED',
    lockedResidual: 100,
    currentResidual: 100,
    settlerVerdict: 'unknown',
    ...overrides,
  };
}

describe('resolvePaypalCaptureOutcome — §3 state table', () => {
  it('3a: UNPAID + APPROVED + EXACT residual → capture_then_finalize (happy path)', () => {
    expect(resolvePaypalCaptureOutcome(state({}))).toEqual({
      kind: 'capture_then_finalize',
    });
  });

  it('3a: UNPAID + CREATED + EXACT residual → capture_then_finalize', () => {
    expect(
      resolvePaypalCaptureOutcome(state({ paypalOrderStatus: 'CREATED' }))
    ).toEqual({ kind: 'capture_then_finalize' });
  });

  it('3a: UNPAID + APPROVED + UNDER (order total raised post-mint) → reject_underpayment before capture (F-194)', () => {
    const outcome = resolvePaypalCaptureOutcome(
      state({ lockedResidual: 100, currentResidual: 130 })
    );
    expect(outcome).toEqual({ kind: 'reject_underpayment', captured: false });
  });

  it('3a: UNPAID + APPROVED + OVER (order total lowered post-mint) → reject_overpayment before capture', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({ lockedResidual: 130, currentResidual: 100 })
      )
    ).toEqual({ kind: 'reject_overpayment', captured: false });
  });

  it('3a: UNPAID + COMPLETED + EXACT → reconcile_completed_unpaid (no 2nd charge)', () => {
    expect(
      resolvePaypalCaptureOutcome(state({ paypalOrderStatus: 'COMPLETED' }))
    ).toEqual({ kind: 'reconcile_completed_unpaid' });
  });

  it('3a: UNPAID + COMPLETED + UNDER → reject_underpayment with captured=true (refund+review)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          paypalOrderStatus: 'COMPLETED',
          lockedResidual: 100,
          currentResidual: 130,
        })
      )
    ).toEqual({ kind: 'reject_underpayment', captured: true });
  });

  it('3a: UNPAID + COMPLETED + OVER → reject_overpayment with captured=true', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          paypalOrderStatus: 'COMPLETED',
          lockedResidual: 130,
          currentResidual: 100,
        })
      )
    ).toEqual({ kind: 'reject_overpayment', captured: true });
  });

  it('3a: UNPAID + VOIDED → create_fresh (never captured)', () => {
    expect(
      resolvePaypalCaptureOutcome(state({ paypalOrderStatus: 'VOIDED' }))
    ).toEqual({ kind: 'create_fresh' });
  });

  it('3a: UNPAID + UNKNOWN/lookup-fail → create_fresh', () => {
    expect(
      resolvePaypalCaptureOutcome(state({ paypalOrderStatus: 'UNKNOWN' }))
    ).toEqual({ kind: 'create_fresh' });
  });

  it('3b: PAID (elsewhere) + APPROVED stale approval → block_paid_elsewhere, not captured (F-203)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({ orderPaymentStatus: 'paid', paypalOrderStatus: 'APPROVED' })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: false,
      settlerVerdict: 'unknown',
    });
  });

  it('3b: PAID (elsewhere) + COMPLETED stale order → block_paid_elsewhere captured (auto-refund) (F-203)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({ orderPaymentStatus: 'paid', paypalOrderStatus: 'COMPLETED' })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'unknown',
    });
  });

  it('3b: PARTIALLY_PAID + APPROVED → block_paid_elsewhere', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'partially_paid',
          paypalOrderStatus: 'APPROVED',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: false,
      settlerVerdict: 'unknown',
    });
  });

  it('3b: REFUNDED + COMPLETED → block_paid_elsewhere captured', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'refunded',
          paypalOrderStatus: 'COMPLETED',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'unknown',
    });
  });

  it('3b: CANCELLED + COMPLETED capture → clamp_cancelled', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderShippingStatus: 'cancelled',
          paypalOrderStatus: 'COMPLETED',
        })
      )
    ).toEqual({ kind: 'clamp_cancelled' });
  });

  it('3b: CANCELLED + APPROVED (uncaptured) → block_paid_elsewhere (never captures a cancelled order)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderShippingStatus: 'cancelled',
          paypalOrderStatus: 'APPROVED',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: false,
      settlerVerdict: 'unknown',
    });
  });

  it('3c: PAID + this txn completed AND proven to be the settler → already_paid_idempotent', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'completed',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'this_txn',
        })
      )
    ).toEqual({ kind: 'already_paid_idempotent' });
  });

  it('3c: PAID + this txn completed but settler UNKNOWN → blocks (escalates), never a silent success', () => {
    // Being `completed` is not proof this txn settled the order. Orders paid by a
    // non-PayPal tender never stamp a marker, so this is exactly a stale PayPal
    // capture on a Paystack/Korapay-paid order — it must be escalated, not
    // reported clean.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'completed',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'unknown',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'unknown',
    });
  });

  it('3c row 2: PAID + this txn pending but IS the settler (lost flip write) → already_paid_idempotent, NOT refund', () => {
    // The writer marked the order paid via this PayPal order but the pending→
    // completed flip write was lost. The atomic marker still names this txn, so a
    // retry must be idempotent — refunding would claw back a legitimate payment.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'pending',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'this_txn',
        })
      )
    ).toEqual({ kind: 'already_paid_idempotent' });
  });

  it('3c row 2: PAID + a DIFFERENT txn is the proven settler → block_paid_elsewhere captured (auto-refund)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'pending',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'other_txn',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'other_txn',
    });
  });

  it('pass-9 P1: PAID + this txn COMPLETED but a DIFFERENT txn is the settler → block (stranded duplicate), NOT idempotent success', () => {
    // Rule 1 must not report success purely because the txn row is completed: if
    // something else won the paid CAS, this completed capture is a stranded
    // duplicate that has to be refunded.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'completed',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'other_txn',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'other_txn',
    });
  });

  it('pass-9 P1: PAID + UNKNOWN settler (no marker) → blocked but verdict stays unknown so the handler never auto-refunds', () => {
    // A missing marker is NOT proof of duplication (pre-migration paid orders).
    // The verdict rides along so the handler files a manual review instead of
    // clawing back what may be a real payment.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'pending',
          paypalOrderStatus: 'COMPLETED',
          settlerVerdict: 'unknown',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'unknown',
    });
  });

  it('residual within EPSILON is treated as fresh (no false underpayment)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          lockedResidual: 100,
          currentResidual: 100 + PAYPAL_AMOUNT_EPSILON,
        })
      )
    ).toEqual({ kind: 'capture_then_finalize' });
  });

  it('settlement guard runs BEFORE residual freshness (paid + stale residual still blocks, never rejects)', () => {
    // Even if the residual looks stale, a settled order must block, not reject.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          lockedResidual: 100,
          currentResidual: 200,
          paypalOrderStatus: 'COMPLETED',
        })
      )
    ).toEqual({
      kind: 'block_paid_elsewhere',
      captured: true,
      settlerVerdict: 'unknown',
    });
  });
});
