import 'server-only';

/**
 * Who settled this order? — the single authority for that question.
 *
 * `orders.paid_transaction_id` is stamped ATOMICALLY by the CAS-winning writer
 * (see reconcile-paypal-order.ts), so it is the only crash-safe record of which
 * transaction actually paid an order.
 *
 * The critical distinction — and the reason this is a THREE-state verdict rather
 * than a boolean — is that a missing marker is NOT proof of duplication:
 *
 *  - `this_txn`  the marker names THIS transaction → we settled it → idempotent.
 *  - `other_txn` the marker names a DIFFERENT transaction → positive proof that
 *                something else settled the order → our capture is a duplicate
 *                and may be auto-refunded.
 *  - `unknown`   no marker (a pre-migration paid order, or a paid path that does
 *                not stamp it). We CANNOT prove who settled it. Never auto-refund
 *                on this verdict — a real payment could be clawed back. File a
 *                manual review instead.
 *
 * Rule enforced by every caller: **auto-refund requires `other_txn`.**
 */
export type PaypalSettlerVerdict = 'this_txn' | 'other_txn' | 'unknown';

export function resolvePaypalSettlerVerdict(
  paidTransactionId: string | null | undefined,
  thisTransactionId: string
): PaypalSettlerVerdict {
  if (!paidTransactionId) {
    return 'unknown';
  }
  return paidTransactionId === thisTransactionId ? 'this_txn' : 'other_txn';
}

/** Only a positively-identified different settler justifies clawing funds back. */
export function isProvenDuplicate(verdict: PaypalSettlerVerdict): boolean {
  return verdict === 'other_txn';
}
