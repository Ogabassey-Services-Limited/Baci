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

/** Per-capture refund result, so partial failures can be surfaced (R-55). */
export interface PaypalCaptureRefundOutcome {
  captureId: string;
  success: boolean;
  refundId?: string;
  error?: string;
}

export interface PaypalOrderRefundResult {
  /** True only when EVERY completed capture on the order was refunded. */
  success: boolean;
  /** First successful refund id — kept for the single-capture caller contract. */
  refundId?: string;
  /** All successful refund ids (one per refunded capture). */
  refundIds?: string[];
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

    if (result.success) {
      outcomes.push({ captureId, success: true, refundId: result.data.id });
    } else {
      logger.error({
        message: 'PayPal capture refund failed',
        merchantId: params.merchantId,
        captureId,
        error: result.error,
      });
      outcomes.push({ captureId, success: false, error: result.error });
    }
  }

  const refundIds = outcomes
    .filter((outcome) => outcome.success && !!outcome.refundId)
    .map((outcome) => outcome.refundId as string);
  const failed = outcomes.filter((outcome) => !outcome.success);

  if (failed.length === 0) {
    return {
      success: true,
      refundId: refundIds[0],
      refundIds,
      captures: outcomes,
    };
  }

  const failedIds = failed.map((outcome) => outcome.captureId).join(', ');
  const error =
    refundIds.length > 0
      ? `Refunded ${refundIds.length} of ${outcomes.length} PayPal captures; failed: ${failedIds}`
      : (failed[0]?.error ?? 'PayPal refund failed');

  return {
    success: false,
    refundId: refundIds[0],
    refundIds,
    error,
    captures: outcomes,
  };
}
