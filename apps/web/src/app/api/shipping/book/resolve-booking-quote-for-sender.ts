import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type OrderShipmentQuoteRecord,
  refreshOrderShipmentQuote,
} from '@/lib/shipping/refresh-order-shipment-quote';
import type {
  ShippingAddress,
  ShippingProviderCode,
} from '@/lib/shipping/types';

/**
 * Domestic bookings always use the registered merchant sender. If the stored
 * quote was priced for a different origin, refresh before booking so rate IDs
 * and metadata match the sender we actually ship from.
 */
export async function resolveBookingQuoteForSender(
  supabase: SupabaseClient,
  quote: OrderShipmentQuoteRecord,
  provider: ShippingProviderCode,
  options: {
    merchantSender: ShippingAddress;
    usesStoredInternationalSender: boolean;
  }
): Promise<OrderShipmentQuoteRecord> {
  if (options.usesStoredInternationalSender) {
    return quote;
  }

  return await refreshOrderShipmentQuote(
    supabase,
    quote,
    provider,
    options.merchantSender
  );
}
