import 'server-only';

import type { PaypalSettlerVerdict } from '@/lib/payments/paypal-settler-verdict';

/**
 * The single authoritative PayPal capture-outcome resolver (see
 * docs/payments/paypal-capture-reconciliation-design.md §4a). Pure — no I/O, no
 * side effects — so every row of the §3 state-transition table is exhaustively
 * unit-testable. EVERY capture/reconcile decision (create-order completed-txn
 * guard, capture-order pre-capture, verify reconcile) funnels through this
 * function; no route re-derives "is this order payable / already paid /
 * correctly priced" from its own subset of state again.
 *
 * The amount contract lives in §2 of the design. This resolver owns the
 * residual-freshness leg of it: `lockedResidual` (transactions.amount, what the
 * buyer approved) is compared against `currentResidual`
 * (computeOrderResidualAmount recomputed now) to catch an order total that moved
 * after the PayPal order was minted. Capture-set integrity
 * (capturedPresentment vs presentmentAmount) stays in `validatePaypalCaptureSet`.
 */

/** PayPal rounding tolerance shared with `validatePaypalCaptureSet`. */
export const PAYPAL_AMOUNT_EPSILON = 0.02;

export type PaypalOrderStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'PAYER_ACTION_REQUIRED'
  | 'COMPLETED'
  | 'VOIDED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface PaypalCaptureState {
  /** unpaid | paid | partially_paid | refunded | (bnpl_approved, …) */
  orderPaymentStatus: string | null;
  orderShippingStatus: string | null;
  /** This PayPal transaction row's status: pending | completed | … */
  txnStatus: string;
  /** The live/derived PayPal Order status, when known. */
  paypalOrderStatus?: PaypalOrderStatus;
  /** transactions.amount — order-ccy residual the buyer approved (§2). */
  lockedResidual: number;
  /** computeOrderResidualAmount recomputed at capture/reconcile time (§2). */
  currentResidual: number;
  /**
   * Who settled this order, per the atomically-stamped
   * `orders.paid_transaction_id` (see paypal-settler-verdict.ts). THREE states,
   * not a boolean: `unknown` (no marker) is NOT proof that another txn settled
   * the order, so it must never trigger an auto-refund. */
  settlerVerdict: PaypalSettlerVerdict;
  /** Set once a capture response exists (informational; integrity is checked
   * separately by validatePaypalCaptureSet). */
  capturedPresentment?: number;
  presentmentAmount?: number;
}

export type PaypalCaptureOutcome =
  | { kind: 'capture_then_finalize' }
  | { kind: 'reconcile_completed_unpaid' }
  | { kind: 'already_paid_idempotent' }
  /**
   * The order was settled by something other than this capture. `settlerVerdict`
   * decides what the handler may do with a landed capture: `other_txn` is
   * positive proof of duplication (auto-refund); `unknown` only warrants a
   * manual review — refunding there could claw back a real payment.
   */
  | {
      kind: 'block_paid_elsewhere';
      captured: boolean;
      settlerVerdict: PaypalSettlerVerdict;
    }
  | { kind: 'reject_underpayment'; captured: boolean }
  | { kind: 'reject_overpayment'; captured: boolean }
  | { kind: 'clamp_cancelled' }
  | { kind: 'create_fresh' };

/** Payment statuses that mean the order was already settled by SOME tender. */
const SETTLED_PAYMENT_STATUSES = new Set([
  'paid',
  'partially_paid',
  'refunded',
]);

const KNOWN_PAYPAL_STATUSES = new Set<PaypalOrderStatus>([
  'CREATED',
  'APPROVED',
  'PAYER_ACTION_REQUIRED',
  'COMPLETED',
  'VOIDED',
  'EXPIRED',
]);

/** Normalizes a raw PayPal order status string to the resolver's enum. */
export function mapPaypalOrderStatus(
  raw: string | null | undefined
): PaypalOrderStatus {
  if (!raw) {
    return 'UNKNOWN';
  }
  const normalized = raw.trim().toUpperCase() as PaypalOrderStatus;
  return KNOWN_PAYPAL_STATUSES.has(normalized) ? normalized : 'UNKNOWN';
}

/**
 * True when the order is already settled or cancelled, so the pre-capture step
 * must look up the live PayPal status (to know whether a stale order captured)
 * before resolving. A plainly-unpaid order skips the lookup and captures
 * optimistically.
 */
export function needsPaypalStatusLookup(
  paymentStatus: string | null,
  shippingStatus: string | null
): boolean {
  return (
    SETTLED_PAYMENT_STATUSES.has(String(paymentStatus)) ||
    shippingStatus === 'cancelled'
  );
}

const CAPTURABLE_PAYPAL_STATUSES = new Set<PaypalOrderStatus>([
  'CREATED',
  'APPROVED',
  'PAYER_ACTION_REQUIRED',
]);

function isCaptured(status: PaypalOrderStatus | undefined): boolean {
  return status === 'COMPLETED';
}

/**
 * Encodes §3 as one deterministic, first-match-wins decision. The ordering is
 * load-bearing: settlement/cancellation guards run BEFORE any residual or
 * capturable check so a second charge (F-203) can never slip through.
 */
export function resolvePaypalCaptureOutcome(
  state: PaypalCaptureState
): PaypalCaptureOutcome {
  // NOTE: `txnStatus` is deliberately NOT consulted here. A completed transaction
  // row is not evidence that THIS txn settled the order — only the atomic settler
  // marker is (see rule 1). Its other job, telling us PayPal already captured, is
  // done upstream: the funnel derives `paypalOrderStatus = COMPLETED` from it.
  const {
    orderPaymentStatus,
    orderShippingStatus,
    paypalOrderStatus,
    lockedResidual,
    currentResidual,
    settlerVerdict,
  } = state;

  const captured = isCaptured(paypalOrderStatus);
  const paid = orderPaymentStatus === 'paid';
  const cancelled = orderShippingStatus === 'cancelled';

  // 1. ONLY positive proof that THIS txn settled the order takes the idempotent
  //    fast path. Everything else on a paid order falls through to rule 2.
  //
  //    In particular `unknown` must NOT short-circuit here, even when this txn is
  //    already `completed`: orders paid by a NON-PayPal tender (Paystack/Korapay)
  //    never stamp `paid_transaction_id`, so `unknown` is precisely the state of a
  //    stale PayPal capture landing on an order another gateway paid. Reporting
  //    that as clean success would leave real duplicate funds in the merchant's
  //    PayPal account with nobody told. Rule 2 blocks it and files a review (and
  //    still never auto-refunds an unprovable duplicate).
  if (paid && settlerVerdict === 'this_txn') {
    return { kind: 'already_paid_idempotent' };
  }

  // 2. The order was settled by something other than this capture (another
  //    PayPal order or another tender) while THIS approval returned. NEVER
  //    capture — that is a second, untracked charge (F-203). The verdict rides
  //    along so the handler auto-refunds a landed capture ONLY on positive proof
  //    of a different settler (`other_txn`); an `unknown` marker is filed for
  //    manual review instead, because refunding it could claw back a real
  //    payment.
  if (SETTLED_PAYMENT_STATUSES.has(String(orderPaymentStatus))) {
    return { kind: 'block_paid_elsewhere', captured, settlerVerdict };
  }

  // 3. Cancelled order. A landed capture is clamped + filed for manual refund;
  //    an uncaptured-but-capturable PayPal order is blocked (create-order
  //    already rejects cancelled orders — this is defence-in-depth). Guarding
  //    here also stops rule 6 from ever capturing on a cancelled order. (§3b)
  if (cancelled) {
    return captured
      ? { kind: 'clamp_cancelled' }
      : { kind: 'block_paid_elsewhere', captured: false, settlerVerdict };
  }

  // 4. Residual freshness (§2). A raised order total (or a removed prepaid
  //    tender) makes the buyer underpay → reject BEFORE capture. A lowered
  //    total makes them overpay → reject. Both refund + review if already
  //    captured. (F-194)
  if (currentResidual - lockedResidual > PAYPAL_AMOUNT_EPSILON) {
    return { kind: 'reject_underpayment', captured };
  }
  if (lockedResidual - currentResidual > PAYPAL_AMOUNT_EPSILON) {
    return { kind: 'reject_overpayment', captured };
  }

  // 5. PayPal already captured (our txn write was lost). Reconcile without a
  //    second charge. (§3a COMPLETED row)
  if (paypalOrderStatus === 'COMPLETED') {
    return { kind: 'reconcile_completed_unpaid' };
  }

  // 6. Still approvable and never captured — the happy path.
  if (paypalOrderStatus && CAPTURABLE_PAYPAL_STATUSES.has(paypalOrderStatus)) {
    return { kind: 'capture_then_finalize' };
  }

  // 7. VOIDED / EXPIRED / UNKNOWN / lookup-failed → nothing indicates a
  //    capture, so it is safe to tell the client to mint a fresh order.
  return { kind: 'create_fresh' };
}
