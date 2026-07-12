import 'server-only';

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
   * True when THIS transaction is the one that settled the order — i.e. the
   * CAS-winning writer stamped its `paypal_split` onto this txn row. The split
   * is only ever written to the settling txn, so a genuine duplicate (a
   * different PayPal order settled this order) never carries it. Lets the
   * resolver tell a lost pending→completed flip write (idempotent) from a real
   * second charge (block+refund). §3c row 2. */
  thisTxnSettledOrder?: boolean;
  /** Set once a capture response exists (informational; integrity is checked
   * separately by validatePaypalCaptureSet). */
  capturedPresentment?: number;
  presentmentAmount?: number;
}

export type PaypalCaptureOutcome =
  | { kind: 'capture_then_finalize' }
  | { kind: 'reconcile_completed_unpaid' }
  | { kind: 'already_paid_idempotent' }
  | { kind: 'block_paid_elsewhere'; captured: boolean }
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
  const {
    orderPaymentStatus,
    orderShippingStatus,
    txnStatus,
    paypalOrderStatus,
    lockedResidual,
    currentResidual,
    thisTxnSettledOrder,
  } = state;

  const captured = isCaptured(paypalOrderStatus);
  const paid = orderPaymentStatus === 'paid';
  const cancelled = orderShippingStatus === 'cancelled';

  // 1. This txn already paid the order — the CAS winner ran side effects and
  //    recorded amount_paid. Idempotent success. (§3c row 1)
  if (paid && txnStatus === 'completed') {
    return { kind: 'already_paid_idempotent' };
  }

  // 1b. This PayPal order legitimately settled the order, but its pending→
  //     completed flip write was lost (order is paid, this txn still pending,
  //     yet the settlement split the CAS-winner stamps on the SETTLING txn is
  //     present on this row). Idempotent — refunding here would claw back a
  //     real payment. This is what distinguishes a lost-write from a genuine
  //     duplicate; a duplicate never carries this order's split. (§3c row 2)
  if (paid && thisTxnSettledOrder) {
    return { kind: 'already_paid_idempotent' };
  }

  // 2. The order was settled by ANOTHER path (another PayPal order or another
  //    tender) while THIS pending txn returned to a stale approval. NEVER
  //    capture — that is a second, untracked charge (F-203). If this stale
  //    PayPal order was captured after settlement, the caller auto-refunds it
  //    and files `captured_after_settlement`.
  if (SETTLED_PAYMENT_STATUSES.has(String(orderPaymentStatus))) {
    return { kind: 'block_paid_elsewhere', captured };
  }

  // 3. Cancelled order. A landed capture is clamped + filed for manual refund;
  //    an uncaptured-but-capturable PayPal order is blocked (create-order
  //    already rejects cancelled orders — this is defence-in-depth). Guarding
  //    here also stops rule 6 from ever capturing on a cancelled order. (§3b)
  if (cancelled) {
    return captured
      ? { kind: 'clamp_cancelled' }
      : { kind: 'block_paid_elsewhere', captured: false };
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
