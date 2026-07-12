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
    ).toEqual({ kind: 'block_paid_elsewhere', captured: false });
  });

  it('3b: PAID (elsewhere) + COMPLETED stale order → block_paid_elsewhere captured (auto-refund) (F-203)', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({ orderPaymentStatus: 'paid', paypalOrderStatus: 'COMPLETED' })
      )
    ).toEqual({ kind: 'block_paid_elsewhere', captured: true });
  });

  it('3b: PARTIALLY_PAID + APPROVED → block_paid_elsewhere', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'partially_paid',
          paypalOrderStatus: 'APPROVED',
        })
      )
    ).toEqual({ kind: 'block_paid_elsewhere', captured: false });
  });

  it('3b: REFUNDED + COMPLETED → block_paid_elsewhere captured', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'refunded',
          paypalOrderStatus: 'COMPLETED',
        })
      )
    ).toEqual({ kind: 'block_paid_elsewhere', captured: true });
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
    ).toEqual({ kind: 'block_paid_elsewhere', captured: false });
  });

  it('3c: PAID + this txn completed → already_paid_idempotent', () => {
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'completed',
          paypalOrderStatus: 'COMPLETED',
        })
      )
    ).toEqual({ kind: 'already_paid_idempotent' });
  });

  it('3c row 2: PAID + this txn pending but IS the settler (lost flip write) → already_paid_idempotent, NOT refund', () => {
    // The writer marked the order paid via this PayPal order (split stamped on
    // this txn) but the pending→completed flip write was lost. A retry must be
    // idempotent — refunding here would claw back a legitimate payment.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'pending',
          paypalOrderStatus: 'COMPLETED',
          thisTxnSettledOrder: true,
        })
      )
    ).toEqual({ kind: 'already_paid_idempotent' });
  });

  it('3c row 2: PAID + this txn pending and NOT the settler (genuine duplicate) → block_paid_elsewhere captured', () => {
    // A DIFFERENT PayPal order settled this one; this txn carries no split, so
    // its own capture is a real duplicate and must be refunded.
    expect(
      resolvePaypalCaptureOutcome(
        state({
          orderPaymentStatus: 'paid',
          txnStatus: 'pending',
          paypalOrderStatus: 'COMPLETED',
          thisTxnSettledOrder: false,
        })
      )
    ).toEqual({ kind: 'block_paid_elsewhere', captured: true });
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
    ).toEqual({ kind: 'block_paid_elsewhere', captured: true });
  });
});
