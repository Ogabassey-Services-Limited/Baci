import 'server-only';

import { logger } from '@/lib/logger';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { refund } from '@/lib/paypal';

/**
 * PayPal (BYOK) refund for a cancelled order (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 item 7). The cancellation
 * route branches on the payment gateway; PayPal money settled straight to the
 * merchant's own PayPal account, so a refund MUST go through that merchant's
 * stored credentials — never a platform key.
 */

/**
 * The state PayPal reports for the refund resource itself.
 *
 * A 2xx from PayPal means "I accepted your refund request", NOT "the buyer has
 * their money back". Only `COMPLETED` means the money moved. `PENDING` is common
 * in BYOK — refunds draw on the merchant's own PayPal balance, so an unfunded
 * balance (or an eCheck) leaves the refund in flight — and `CANCELLED`/`FAILED`
 * mean it never happened.
 */
export type PaypalRefundStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'CANCELLED'
  | 'FAILED';

/** Per-capture refund result, so partial failures can be surfaced (R-55). */
export interface PaypalCaptureRefundOutcome {
  captureId: string;
  /** True ONLY for a COMPLETED refund. A PENDING refund has not returned money. */
  success: boolean;
  /** PayPal's own status for the refund resource, when it answered at all. */
  status?: PaypalRefundStatus;
  refundId?: string;
  error?: string;
}

export interface PaypalOrderRefundResult {
  /** True only when EVERY completed capture on the order was refunded COMPLETED. */
  success: boolean;
  /**
   * True when at least one refund was accepted by PayPal but is still in flight,
   * and none outright failed.
   *
   * This is deliberately NOT folded into `success: false`: a pending refund must
   * never be reported to an operator as "refund failed", because the remedy for a
   * failed refund is to issue another one — and doing that against a refund PayPal
   * is about to complete pays the buyer twice.
   */
  pending?: boolean;
  /** First successful refund id — kept for the single-capture caller contract. */
  refundId?: string;
  /** All COMPLETED refund ids (one per refunded capture). */
  refundIds?: string[];
  /** Accepted-but-not-yet-completed refund ids, for follow-up. */
  pendingRefundIds?: string[];
  /** Human-readable summary when not every capture refunded. */
  error?: string;
  /** Per-capture breakdown for auditing partial refunds. */
  captures?: PaypalCaptureRefundOutcome[];
}

/**
 * Extracts EVERY completed capture id from a stored capture response
 * (`transactions.gateway_response`). A PayPal order can settle as MULTIPLE
 * captures across `purchase_units[].payments.captures[]` (split/partial
 * captures), so refunding only the first would leave the rest un-refunded
 * (R-55). Only `status === 'COMPLETED'` captures are refundable — PENDING/
 * DECLINED/etc. captures are skipped. Returns `[]` when the shape is
 * missing/malformed so callers fail gracefully instead of throwing.
 */
export function extractPaypalCaptureIds(gatewayResponse: unknown): string[] {
  const captureIds: string[] = [];
  if (!gatewayResponse || typeof gatewayResponse !== 'object') {
    return captureIds;
  }
  const purchaseUnits = (gatewayResponse as Record<string, unknown>)
    .purchase_units;
  if (!Array.isArray(purchaseUnits)) {
    return captureIds;
  }
  for (const unit of purchaseUnits) {
    if (!unit || typeof unit !== 'object') {
      continue;
    }
    const payments = (unit as Record<string, unknown>).payments;
    if (!payments || typeof payments !== 'object') {
      continue;
    }
    const captures = (payments as Record<string, unknown>).captures;
    if (!Array.isArray(captures)) {
      continue;
    }
    for (const capture of captures) {
      if (!capture || typeof capture !== 'object') {
        continue;
      }
      const record = capture as Record<string, unknown>;
      const id = record.id;
      if (
        typeof id === 'string' &&
        id.length > 0 &&
        record.status === 'COMPLETED'
      ) {
        captureIds.push(id);
      }
    }
  }
  return captureIds;
}

/**
 * Refunds a cancelled PayPal order's captured payments through the MERCHANT's own
 * stored live credentials. Refunds EVERY completed capture (split/partial
 * captures included, R-55), each a FULL refund (amount omitted) so it settles in
 * exactly the currency/amount PayPal captured — avoiding order-currency ↔
 * presentment-currency FX drift. Customer PayPal checkout is live-only (F10), so
 * both the vault slot and PayPal environment are `live`. Overall success only
 * when all captures refund; partial failures are reported, never thrown, so the
 * cancellation route can surface its normal error shape.
 */
export async function initiatePaypalOrderRefund(params: {
  merchantId: string;
  gatewayResponse: unknown;
  reason: string;
}): Promise<PaypalOrderRefundResult> {
  const captureIds = extractPaypalCaptureIds(params.gatewayResponse);
  if (captureIds.length === 0) {
    logger.error({
      message:
        'PayPal refund aborted: no completed capture found on transaction',
      merchantId: params.merchantId,
    });
    return {
      success: false,
      error: 'PayPal capture reference not found for this order',
    };
  }

  const credentials = await getPaypalCheckoutCredentials(
    params.merchantId,
    'live'
  );
  if (!credentials) {
    return {
      success: false,
      error: 'PayPal is not configured for this store',
    };
  }

  const outcomes: PaypalCaptureRefundOutcome[] = [];
  for (const captureId of captureIds) {
    // Idempotency: each capture gets its OWN stable, capture-derived
    // PayPal-Request-Id, so a retry after a lost/timed-out response reaches the
    // SAME refund at PayPal instead of issuing a duplicate (H2). A capture id is
    // ~17 chars, so `refund-<captureId>` stays within PayPal's 38-char limit.
    // Sequential so one failure never leaves an unbounded set of in-flight
    // refunds; each capture is refunded independently regardless of the others.
    const result = await refund(
      credentials.clientId,
      credentials.secretKey,
      captureId,
      'live',
      { noteToPayer: params.reason, requestId: `refund-${captureId}` }
    );

    if (!result.success) {
      logger.error({
        message: 'PayPal capture refund failed',
        merchantId: params.merchantId,
        captureId,
        error: result.error,
      });
      outcomes.push({ captureId, success: false, error: result.error });
      continue;
    }

    // A 2xx only means PayPal ACCEPTED the request. Read the refund resource's
    // own status: booking a PENDING/FAILED refund as done records a `completed`
    // refund transaction for money the buyer never got back, and tells the ops
    // review row not to chase it.
    const status = result.data.status;
    if (status === 'COMPLETED') {
      outcomes.push({
        captureId,
        success: true,
        status,
        refundId: result.data.id,
      });
      continue;
    }

    if (status === 'PENDING') {
      // In flight, not failed. Surfaced separately so nobody issues a second
      // refund against money PayPal is already sending back.
      logger.warn({
        message:
          'PayPal accepted the refund but it is still PENDING — money has not moved yet',
        merchantId: params.merchantId,
        captureId,
        refundId: result.data.id,
      });
      outcomes.push({
        captureId,
        success: false,
        status,
        refundId: result.data.id,
      });
      continue;
    }

    logger.error({
      message: 'PayPal refused the capture refund',
      merchantId: params.merchantId,
      captureId,
      refundId: result.data.id,
      status,
    });
    outcomes.push({
      captureId,
      success: false,
      status,
      refundId: result.data.id,
      error: `PayPal reported the refund as ${status}`,
    });
  }

  const refundIds = outcomes
    .filter((outcome) => outcome.success && !!outcome.refundId)
    .map((outcome) => outcome.refundId as string);

  const pendingOutcomes = outcomes.filter(
    (outcome) => outcome.status === 'PENDING'
  );
  const pendingRefundIds = pendingOutcomes
    .filter((outcome) => !!outcome.refundId)
    .map((outcome) => outcome.refundId as string);

  // "Not completed" splits two ways, and conflating them is what makes a buyer
  // get paid twice: a hard failure needs another refund, an in-flight one must
  // NOT get one.
  const hardFailed = outcomes.filter(
    (outcome) => !outcome.success && outcome.status !== 'PENDING'
  );

  if (hardFailed.length === 0 && pendingOutcomes.length === 0) {
    return {
      success: true,
      refundId: refundIds[0],
      refundIds,
      captures: outcomes,
    };
  }

  if (hardFailed.length === 0) {
    // Everything PayPal accepted, but some refunds are still moving. Not a
    // success (the money is not back yet) and emphatically not a failure.
    return {
      success: false,
      pending: true,
      refundId: refundIds[0],
      refundIds,
      pendingRefundIds,
      error: `PayPal accepted ${pendingOutcomes.length} of ${outcomes.length} refunds but they are still PENDING — do NOT issue another refund; verify completion at PayPal`,
      captures: outcomes,
    };
  }

  const failedIds = hardFailed.map((outcome) => outcome.captureId).join(', ');
  const pendingNote =
    pendingOutcomes.length > 0
      ? `; ${pendingOutcomes.length} still PENDING (do not re-refund those)`
      : '';
  const error =
    refundIds.length > 0 || pendingOutcomes.length > 0
      ? `Refunded ${refundIds.length} of ${outcomes.length} PayPal captures; failed: ${failedIds}${pendingNote}`
      : (hardFailed[0]?.error ?? 'PayPal refund failed');

  return {
    success: false,
    refundId: refundIds[0],
    refundIds,
    pendingRefundIds:
      pendingRefundIds.length > 0 ? pendingRefundIds : undefined,
    error,
    captures: outcomes,
  };
}
