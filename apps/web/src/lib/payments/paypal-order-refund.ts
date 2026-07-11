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

export interface PaypalOrderRefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

/**
 * Safely pulls the first PayPal capture id out of a stored capture response
 * (`transactions.gateway_response`). The capture route persists the full
 * Orders v2 capture resource, whose captured-payment ids live at
 * `purchase_units[].payments.captures[].id`. Returns `null` when the shape is
 * missing/malformed so callers fail gracefully instead of throwing.
 */
export function extractPaypalCaptureId(
  gatewayResponse: unknown
): string | null {
  if (!gatewayResponse || typeof gatewayResponse !== 'object') {
    return null;
  }
  const purchaseUnits = (gatewayResponse as Record<string, unknown>)
    .purchase_units;
  if (!Array.isArray(purchaseUnits)) {
    return null;
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
      if (capture && typeof capture === 'object') {
        const id = (capture as Record<string, unknown>).id;
        if (typeof id === 'string' && id.length > 0) {
          return id;
        }
      }
    }
  }
  return null;
}

/**
 * Refunds a cancelled PayPal order's captured payment through the MERCHANT's own
 * stored live credentials. Does a FULL refund of the original capture (amount
 * omitted) so it settles in exactly the currency/amount PayPal captured —
 * avoiding any order-currency ↔ presentment-currency FX drift. Customer PayPal
 * checkout is live-only (F10), so both the vault slot and PayPal environment are
 * `live`. Fails gracefully (never throws) when the capture id or credentials are
 * missing so the cancellation route can surface its normal error shape.
 */
export async function initiatePaypalOrderRefund(params: {
  merchantId: string;
  gatewayResponse: unknown;
  reason: string;
}): Promise<PaypalOrderRefundResult> {
  const captureId = extractPaypalCaptureId(params.gatewayResponse);
  if (!captureId) {
    logger.error({
      message: 'PayPal refund aborted: capture id not found on transaction',
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

  // Idempotency: a STABLE PayPal-Request-Id derived from the capture id means a
  // retry after a lost/timed-out response reaches the SAME refund at PayPal
  // instead of issuing a second full refund (H2). A capture id is ~17 chars, so
  // `refund-<captureId>` stays within PayPal's 38-char PayPal-Request-Id limit.
  const result = await refund(
    credentials.clientId,
    credentials.secretKey,
    captureId,
    'live',
    { noteToPayer: params.reason, requestId: `refund-${captureId}` }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, refundId: result.data.id };
}
