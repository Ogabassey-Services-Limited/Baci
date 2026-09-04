import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type WorkerSupabase = SupabaseClient<Database>;

/**
 * Merchant push payload for GIGL tracking. Order-backed shipments keep the
 * shipment_tracking deep-link; orderless repair pickups use type=repair so
 * mobile-admin routes to the repair (not the orders list).
 */
export async function buildGiglTrackingMerchantPushPayload(
  supabase: WorkerSupabase,
  notification: {
    merchant_id: string;
    order_id: string | null;
    shipment_id: string;
  }
): Promise<Record<string, string>> {
  if (notification.order_id) {
    return {
      orderId: notification.order_id,
      type: 'shipment_tracking',
    };
  }

  const { data, error } = await supabase
    .from('repairs')
    .select('id')
    .eq('shipment_id', notification.shipment_id)
    .eq('merchant_id', notification.merchant_id)
    .maybeSingle();
  if (error) throw error;

  const repairId =
    data && typeof data === 'object' && typeof data.id === 'string'
      ? data.id
      : null;

  return repairId
    ? { type: 'repair', repairId }
    : { type: 'repair', shipmentId: notification.shipment_id };
}
