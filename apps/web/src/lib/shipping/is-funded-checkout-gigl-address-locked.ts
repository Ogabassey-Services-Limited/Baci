import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOrderGiglSettledRetainedAmount } from '@/lib/shipping/load-order-gigl-settled-retained-amount';

export type FundedCheckoutGiglAddressLockOrder = {
  payment_status?: string | null;
  selected_quote_id?: string | null;
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_provider?: string | null;
};

/**
 * Paid customer-checkout GIGL address edits lock only when merchant_settlements
 * has actually retained shipping. Quote-time economics snapshots (and the
 * stamp trigger) can show a positive retained amount for quiz_voucher / zero-
 * retention checkouts that never settled — those must stay editable so Admin
 * can clear the quote and switch to merchant-wallet funding. Mirrors
 * private.order_settled_gigl_retained_amount.
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

  const settledRetained = await loadOrderGiglSettledRetainedAmount(
    supabase,
    merchantId,
    orderId
  );

  return settledRetained > 0;
}
