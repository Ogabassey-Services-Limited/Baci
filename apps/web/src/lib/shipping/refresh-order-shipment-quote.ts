import type { SupabaseClient } from '@supabase/supabase-js';
import { shippingService } from '@/lib/shipping';
import { domesticSendersDiffer } from '@/lib/shipping/merchant-sender-comparison';
import {
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
  selectPreferredQuote,
} from '@/lib/shipping/order-shipment-booking-utils';
import { persistRefreshedShippingQuote } from '@/lib/shipping/persist-refreshed-shipping-quote';
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
  provider_cost?: number | null;
  platform_margin?: number | null;
  platform_margin_bps?: number | null;
  pricing_version?: string | null;
};

export type RefreshOrderShipmentQuoteOptions = {
  allowRefresh?: boolean;
};

export async function refreshOrderShipmentQuote(
  _supabase: SupabaseClient,
  quote: OrderShipmentQuoteRecord,
  provider: ShippingProviderCode,
  senderOverride?: ShippingAddress,
  options: RefreshOrderShipmentQuoteOptions = {}
): Promise<OrderShipmentQuoteRecord> {
  const quoteRequest = parseStoredQuoteRequest(quote.quote_request);
  const domesticSenderNeedsRefresh = Boolean(
    senderOverride &&
      quoteRequest?.shipmentType === 'domestic' &&
      (!quoteRequest.sender ||
        domesticSendersDiffer(quoteRequest.sender, senderOverride))
  );
  const needsRefresh =
    new Date(quote.expires_at) < new Date() ||
    (provider === 'TOPSHIP' && !quote.provider_metadata) ||
    domesticSenderNeedsRefresh;

  if (!needsRefresh) {
    return quote;
  }

  if (options.allowRefresh === false) {
    throw new OrderShipmentBookingError(
      'The shipping quote changed or expired. Please get a new quote and confirm shipping before booking.',
      409,
      'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED'
    );
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
    provider_metadata: provider === 'TOPSHIP' ? replacement.rawResponse : null,
    provider_cost: replacement.providerCost ?? null,
    platform_margin: replacement.platformMargin ?? null,
    platform_margin_bps: replacement.marginBasisPoints ?? null,
    pricing_version: replacement.pricingVersion ?? null,
  };

  const { error: upsertError } = await persistRefreshedShippingQuote(
    replacement,
    {
      merchantId: quote.merchant_id,
      sessionId: persistedQuoteRequest.sessionId,
      quoteRequest: persistedQuoteRequest,
    }
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
