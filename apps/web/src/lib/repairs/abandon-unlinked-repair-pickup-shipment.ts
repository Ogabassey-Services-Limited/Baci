import type { SupabaseClient } from '@supabase/supabase-js';

export async function abandonUnlinkedRepairPickupShipment(
  supabase: SupabaseClient,
  merchantId: string,
  shipmentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('shipments')
    .delete()
    .eq('id', shipmentId)
    .eq('merchant_id', merchantId)
    .is('order_id', null)
    .is('provider_shipment_id', null)
    .is('tracking_number', null)
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to abandon unlinked repair pickup shipment:', error);
    return false;
  }

  return true;
}
