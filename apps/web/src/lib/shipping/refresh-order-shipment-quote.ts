import type { SupabaseClient } from '@supabase/supabase-js';
import { shippingService } from '@/lib/shipping';
import { domesticSendersDiffer } from '@/lib/shipping/merchant-sender-comparison';
import {
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
  selectPreferredQuote,
} from '@/lib/shipping/order-shipment-booking-utils';
import type {
  ShippingAddress,
  ShippingProviderCode,
} from '@/lib/shipping/types';

export type OrderShipmentQuoteRecord = {
  id: string;
  merchant_id: string | null;
  provider: string;
  service_tier: string | null;
  carrier_name: string | null;
  price: number | string;
  currency: string;
  estimated_days: number | null;
  provider_rate_id: string | null;
  expires_at: string;
  quote_request: unknown;
  provider_metadata: unknown;
};

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

export function assertQuotePriceMatchesOrderFee(
  quote: Pick<OrderShipmentQuoteRecord, 'price'>,
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

export async function refreshOrderShipmentQuote(
  supabase: SupabaseClient,
  quote: OrderShipmentQuoteRecord,
  provider: ShippingProviderCode,
  senderOverride?: ShippingAddress
): Promise<OrderShipmentQuoteRecord> {
  const quoteRequest = parseStoredQuoteRequest(quote.quote_request);
  const domesticSenderMismatch = Boolean(
    senderOverride &&
      quoteRequest?.shipmentType === 'domestic' &&
      quoteRequest.sender &&
      domesticSendersDiffer(quoteRequest.sender, senderOverride)
  );
  const needsRefresh =
    new Date(quote.expires_at) < new Date() ||
    (provider === 'TOPSHIP' && !quote.provider_metadata) ||
    domesticSenderMismatch;

  if (!needsRefresh) {
    return quote;
  }

  if (!quoteRequest) {
    throw new OrderShipmentBookingError(
      'The saved shipping quote has expired and cannot be refreshed.',
      400,
      'QUOTE_REFRESH_UNAVAILABLE'
    );
  }

  const refreshRequest = {
    ...quoteRequest,
    sessionId: crypto.randomUUID(),
    ...(senderOverride && quoteRequest.shipmentType === 'domestic'
      ? { sender: senderOverride }
      : {}),
  };

  const freshQuotes = await shippingService.getProviderQuotes(
    provider,
    refreshRequest
  );
  const replacement = selectPreferredQuote(freshQuotes, {
    serviceTier: quote.service_tier,
    carrierName: quote.carrier_name,
    providerRateId: quote.provider_rate_id,
  });

  if (!replacement) {
    throw new OrderShipmentBookingError(
      'No active shipping quote is available for this provider right now.',
      400,
      'QUOTE_REFRESH_FAILED'
    );
  }

  // Persist the refresh payload so domestic quotes no longer carry a stale
  // postal-code sender state into later booking/refresh attempts.
  const persistedQuoteRequest = refreshRequest;

  const nextQuote: OrderShipmentQuoteRecord = {
    id: replacement.id,
    merchant_id: quote.merchant_id,
    provider,
    service_tier: replacement.serviceTier,
    carrier_name: replacement.carrierName,
    price: replacement.price,
    currency: replacement.currency,
    estimated_days: replacement.estimatedDays,
    provider_rate_id: replacement.providerRateId || null,
    expires_at: replacement.expiresAt.toISOString(),
    quote_request: persistedQuoteRequest,
    provider_metadata: replacement.rawResponse,
  };

  const { error: upsertError } = await supabase.from('shipping_quotes').upsert(
    {
      id: nextQuote.id,
      merchant_id: quote.merchant_id,
      session_id: persistedQuoteRequest.sessionId,
      provider,
      service_tier: nextQuote.service_tier,
      carrier_name: nextQuote.carrier_name,
      price: nextQuote.price,
      currency: nextQuote.currency,
      estimated_days: nextQuote.estimated_days,
      provider_rate_id: nextQuote.provider_rate_id,
      expires_at: nextQuote.expires_at,
      quote_request: persistedQuoteRequest,
      provider_metadata: nextQuote.provider_metadata,
    },
    { onConflict: 'id' }
  );

  if (upsertError) {
    console.error('Failed to persist refreshed shipping quote', {
      error: upsertError,
      code: upsertError.code,
      message: upsertError.message,
      quoteId: nextQuote.id,
      merchantId: quote.merchant_id,
      provider,
    });
    throw new OrderShipmentBookingError(
      'Failed to persist the refreshed shipping quote.',
      500,
      'QUOTE_REFRESH_PERSIST_FAILED'
    );
  }

  return nextQuote;
}
