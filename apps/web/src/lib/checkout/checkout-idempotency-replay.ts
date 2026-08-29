import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { OrderCreateInput } from '@/schemas/orders';
import {
  buildOrderIdempotencyPayload,
  hashOrderIdempotencyPayload,
  type OrderIdempotencyPayloadInput,
} from './order-idempotency';
import { buildLegacyOrderIdempotencyPayload } from './order-idempotency-legacy';

type CheckoutIdempotencyReplayInput = {
  canonicalAirportType: OrderCreateInput['airport_type'];
  canonicalDeliveryMethod: OrderCreateInput['delivery_method'];
  merchantId: string;
  payload: OrderIdempotencyPayloadInput | null;
  requestIdempotencyKey: string | null;
  supabase: SupabaseClient;
};

type CheckoutIdempotencyReplayResult = {
  checkoutRequestHash: string | null;
  isLegacyIdempotencyReplay: boolean;
};

/**
 * Check whether a merchant-rate request already created an order. Replays must
 * bypass current rate verification so an edited/deleted rate cannot invalidate
 * the original order's locked shipping fee.
 */
export async function hasExistingMerchantRateOrder({
  adminSupabase,
  merchantId,
  requestIdempotencyKey,
  shippingRateId,
}: {
  adminSupabase: SupabaseClient;
  merchantId: string;
  requestIdempotencyKey: string;
  shippingRateId: string;
}): Promise<boolean> {
  const { data: existingOrder, error: existingOrderError } = await adminSupabase
    .from('orders')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('checkout_idempotency_key', requestIdempotencyKey)
    .maybeSingle();

  if (existingOrderError) {
    logger.warn({
      message:
        'Idempotent merchant-rate order pre-check failed; running full rate verification',
      merchantId,
      shippingRateId,
      error: existingOrderError,
    });
    return false;
  }

  return existingOrder !== null;
}

/**
 * Build the current idempotency hash and, only when the database confirms a
 * pre-metadata order, rebuild the legacy hash used by that original request.
 */
export async function prepareCheckoutIdempotencyReplay({
  canonicalAirportType,
  canonicalDeliveryMethod,
  merchantId,
  payload,
  requestIdempotencyKey,
  supabase,
}: CheckoutIdempotencyReplayInput): Promise<CheckoutIdempotencyReplayResult> {
  if (!requestIdempotencyKey || !payload) {
    return {
      checkoutRequestHash: null,
      isLegacyIdempotencyReplay: false,
    };
  }

  const checkoutRequestPayload = buildOrderIdempotencyPayload(payload);
  let checkoutRequestHash = hashOrderIdempotencyPayload(checkoutRequestPayload);
  let isLegacyIdempotencyReplay = false;

  // Delivery metadata was added after the first storefront idempotency hash.
  // Probe the merchant-scoped row before accepting the legacy hash so a new
  // request can never opt itself into the pre-metadata replay form.
  if (canonicalDeliveryMethod || canonicalAirportType) {
    const { data: isLegacyOrder, error: legacyProbeError } = await supabase.rpc(
      'is_legacy_storefront_order_idempotency_key',
      {
        p_checkout_idempotency_key: requestIdempotencyKey,
        p_merchant_id: merchantId,
      }
    );

    if (legacyProbeError) {
      logger.warn({
        message:
          'Legacy checkout idempotency probe failed; using the current request hash',
        merchantId,
        error: legacyProbeError,
      });
    } else if (isLegacyOrder === true) {
      isLegacyIdempotencyReplay = true;
      checkoutRequestHash = hashOrderIdempotencyPayload(
        buildLegacyOrderIdempotencyPayload(payload)
      );
    }
  }

  return { checkoutRequestHash, isLegacyIdempotencyReplay };
}
