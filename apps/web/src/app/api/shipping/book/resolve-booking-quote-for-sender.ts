import type { SupabaseClient } from '@supabase/supabase-js';
import { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
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
    merchantSender?: ShippingAddress;
    usesStoredInternationalSender: boolean;
    expectedShippingFee?: number | string | null;
  }
): Promise<OrderShipmentQuoteRecord> {
  if (options.usesStoredInternationalSender) {
    return quote;
  }

  if (!options.merchantSender) {
    throw new OrderShipmentBookingError(
      'Registered merchant sender is required for domestic shipment booking.',
      400,
      'MERCHANT_SENDER_REQUIRED'
    );
  }

  const refreshedQuote = await refreshOrderShipmentQuote(
    supabase,
    quote,
    provider,
    options.merchantSender
  );

  assertQuotePriceMatchesOrderFee(refreshedQuote, options.expectedShippingFee);

  return refreshedQuote;
}

function parseAmount(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function assertQuotePriceMatchesOrderFee(
  quote: OrderShipmentQuoteRecord,
  expectedShippingFee: number | string | null | undefined
): void {
  if (expectedShippingFee === null || expectedShippingFee === undefined) {
    return;
  }

  const quotePrice = parseAmount(quote.price);
  const orderFee = parseAmount(expectedShippingFee);

  if (
    quotePrice === null ||
    orderFee === null ||
    Math.abs(quotePrice - orderFee) > 0.01
  ) {
    throw new OrderShipmentBookingError(
      'The shipping price changed. Please get a new shipping quote before shipping.',
      400,
      'QUOTE_PRICE_CHANGED'
    );
  }
}
