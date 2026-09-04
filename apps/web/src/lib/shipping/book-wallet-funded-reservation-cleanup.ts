import type { SupabaseClient } from '@supabase/supabase-js';
import {
  refundMerchantShippingCharge,
  type reserveMerchantShippingCharge,
} from './merchant-shipping-charge';

type ReleaseLock = () => Promise<void>;
export type WalletChargeReservation = Awaited<
  ReturnType<typeof reserveMerchantShippingCharge>
>;

const ACTIVE_WALLET_CHARGE_STATUSES = [
  'reserved',
  'provider_submitting',
] as const;

/**
 * Detect reserved or provider_submitting charges so reserve/recovery runs
 * before quote refresh (active submissions block quote replacement).
 */
export async function hasActiveMerchantShippingCharge(
  supabase: SupabaseClient,
  orderId: string,
  quoteId: string
): Promise<boolean | null> {
  if (typeof supabase.from !== 'function') return false;
  try {
    const { data, error } = await supabase
      .from('merchant_shipping_charges')
      .select('id')
      .eq('order_id', orderId)
      .eq('shipping_quote_id', quoteId)
      .in('status', [...ACTIVE_WALLET_CHARGE_STATUSES])
      .limit(1);
    if (error) return null;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return null;
  }
}

export async function cleanupPreSubmissionReservation(
  supabase: SupabaseClient,
  reservation: WalletChargeReservation,
  reasonCode: string,
  releaseLock?: ReleaseLock
): Promise<void> {
  try {
    await refundMerchantShippingCharge(
      supabase,
      reservation.charge.chargeId,
      reservation.token,
      reasonCode
    );
  } catch {
    console.error('Wallet shipping refund failed during cleanup.');
  }
  if (releaseLock) {
    try {
      await releaseLock();
    } catch {
      console.error('Booking lock release failed during cleanup.');
    }
  }
}
