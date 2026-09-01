import type { QuoteRequest, ShippingQuote } from '@/lib/shipping/types';

export interface ShippingQuoteUpsertContext {
  merchantId?: string | null;
  sessionId: string;
  quoteRequest: QuoteRequest;
}

export function toShippingQuoteUpsert(
  quote: ShippingQuote,
  context: ShippingQuoteUpsertContext
) {
  return {
    id: quote.id,
    merchant_id: context.merchantId ?? null,
    session_id: context.sessionId,
    provider: quote.provider,
    service_tier: quote.serviceTier,
    carrier_name: quote.carrierName,
    price: quote.price,
    provider_cost: quote.providerCost ?? null,
    platform_margin: quote.platformMargin ?? null,
    platform_margin_bps: quote.marginBasisPoints ?? null,
    pricing_version: quote.pricingVersion ?? null,
    currency: quote.currency,
    estimated_days: quote.estimatedDays,
    min_days: quote.minDays,
    max_days: quote.maxDays,
    pickup_included: quote.pickupIncluded,
    insurance_included: quote.insuranceIncluded,
    is_station_pickup: quote.isStationPickup || false,
    station_name: quote.stationName,
    station_address: quote.stationAddress,
    provider_rate_id: quote.providerRateId,
    provider_metadata: quote.rawResponse,
    expires_at: quote.expiresAt.toISOString(),
    quote_request: context.quoteRequest,
  };
}
