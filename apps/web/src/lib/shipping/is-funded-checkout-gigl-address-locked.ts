import type { SupabaseClient } from '@supabase/supabase-js';
import { hasGiglCheckoutShippingRetention } from '@/lib/shipping/assert-gigl-customer-checkout-prepaid';
import { getShippingQuoteBookingEconomics } from '@/lib/shipping/shipping-quote-booking-economics';

export type FundedCheckoutGiglAddressLockOrder = {
  payment_status?: string | null;
  selected_quote_id?: string | null;
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_provider?: string | null;
};

/**
 * Paid customer-checkout GIGL retention is projected through the booking
 * economics RPC — never via revoked orders.shipping_platform_retained_amount.
 */
export async function isFundedCheckoutGiglAddressLocked(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  order: FundedCheckoutGiglAddressLockOrder
): Promise<boolean> {
  const selectedQuoteId = order.selected_quote_id?.trim() ?? '';
  if (
    order.shipping_provider !== 'GIGL' ||
    (order.payment_status ?? '').trim().toLowerCase() !== 'paid' ||
    order.shipping_funding_source !== 'customer_checkout' ||
    selectedQuoteId === ''
  ) {
    return false;
  }

  const economics = await getShippingQuoteBookingEconomics(
    supabase,
    merchantId,
    orderId,
    selectedQuoteId
  );

  return hasGiglCheckoutShippingRetention({
    shipping_funding_source: order.shipping_funding_source,
    shipping_platform_retained_amount:
      economics?.shipping_platform_retained_amount ?? null,
  });
}
