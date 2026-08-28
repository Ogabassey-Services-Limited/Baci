import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderCreateInput } from '@/schemas/orders';

type PersistReplayedDeliveryMetadataInput = {
  adminClient: SupabaseClient;
  airportType: OrderCreateInput['airport_type'];
  currentAirportType?: string | null;
  currentDeliveryMethod?: string | null;
  deliveryMethod: OrderCreateInput['delivery_method'];
  merchantId: string;
  orderId: string;
};

type PersistReplayedDeliveryMetadataResult = {
  attempted: boolean;
  error: unknown | null;
};

/**
 * Backfill delivery metadata on a legacy idempotency replay when the original
 * order predates the metadata columns or the rollout-time persistence path.
 * Existing non-null metadata is never overwritten.
 */
export async function persistReplayedDeliveryMetadata({
  adminClient,
  airportType,
  currentAirportType,
  currentDeliveryMethod,
  deliveryMethod,
  merchantId,
  orderId,
}: PersistReplayedDeliveryMetadataInput): Promise<PersistReplayedDeliveryMetadataResult> {
  if (!deliveryMethod && !airportType) {
    return { attempted: false, error: null };
  }

  const metadata = {
    ...(deliveryMethod && currentDeliveryMethod == null
      ? { delivery_method: deliveryMethod }
      : {}),
    ...(airportType && currentAirportType == null
      ? { airport_type: airportType }
      : {}),
  };

  if (Object.keys(metadata).length === 0) {
    return { attempted: false, error: null };
  }

  const { error } = await adminClient
    .from('orders')
    .update(metadata)
    .eq('id', orderId)
    .eq('merchant_id', merchantId);

  return { attempted: true, error };
}
