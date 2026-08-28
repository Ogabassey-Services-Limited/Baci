import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAirportDeliveryAddress } from '@/lib/checkout/airport-delivery-address';
import { getLocalAirportDeliveryFee } from '@/lib/checkout/airport-delivery-fee';
import { isAmbiguousMetadataFreeAirportFee } from '@/lib/checkout/airport-delivery-fee-ambiguity';
import { getLegacyAirportType } from '@/lib/checkout/airport-delivery-legacy-marker';
import { isEligibleAirportQuote } from '@/lib/checkout/airport-delivery-quote-validation';
import { isConfirmedLocalAirportReplay } from '@/lib/checkout/is-confirmed-local-airport-replay';
import { isLegacyMobileAirportDeliveryRequest } from '@/lib/checkout/is-legacy-mobile-airport-delivery';
import { isSelectedAirportQuote } from '@/lib/checkout/is-selected-airport-quote';
import { LocalAirportDeliveryFeeMismatchError } from '@/lib/checkout/local-airport-delivery-fee-mismatch-error';
import type { LocalAirportDeliveryFeeValidationResult } from '@/lib/checkout/local-airport-delivery-fee-validation-result';
import { LocalAirportDeliveryValidationError } from '@/lib/checkout/local-airport-delivery-validation-error';
import { readAirportQuote } from '@/lib/checkout/read-airport-delivery-quote';
import { resolveLegacyAirportDeliveryMetadata } from '@/lib/checkout/resolve-legacy-airport-delivery-metadata';
import { validateLocalAirportFeeMismatch } from '@/lib/checkout/validate-local-airport-fee-mismatch';
import { logger } from '@/lib/logger';

type AirportType = 'delivery' | 'pickup';

interface ValidateLocalAirportDeliveryFeeInput {
  airportType?: AirportType;
  deliveryMethod?: string;
  merchantId: string;
  requestIdempotencyKey?: string | null;
  selectedQuoteId?: string | null;
  shippingAddress?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  shippingFee: number;
  shippingProvider?: string | null;
  shippingRateId?: string | null;
  source?: string;
  supabase: SupabaseClient;
}

async function validateSelectedAirportQuote({
  merchantId,
  requestIdempotencyKey,
  selectedQuoteId,
  shippingFee,
  shippingProvider,
  supabase,
}: Pick<
  ValidateLocalAirportDeliveryFeeInput,
  | 'merchantId'
  | 'requestIdempotencyKey'
  | 'selectedQuoteId'
  | 'shippingFee'
  | 'shippingProvider'
  | 'supabase'
>): Promise<boolean> {
  if (!selectedQuoteId) return false;

  const { data, error } = await supabase.rpc('get_checkout_shipping_quote', {
    p_merchant_id: merchantId,
    p_quote_id: selectedQuoteId,
  });
  if (error) {
    logger.error({
      message: 'Unable to validate selected airport shipping quote',
      merchantId,
      selectedQuoteId,
      error,
    });
    throw new LocalAirportDeliveryValidationError(
      'Unable to validate the selected airport delivery quote',
      'AIRPORT_QUOTE_LOOKUP_FAILED',
      500
    );
  }

  const quote = readAirportQuote(data);
  if (!quote || !isEligibleAirportQuote(quote, shippingProvider)) {
    throw new LocalAirportDeliveryValidationError(
      'The selected airport delivery quote is not eligible for airport delivery',
      'AIRPORT_QUOTE_INVALID',
      400
    );
  }

  const expiresAt =
    typeof quote.expires_at === 'string'
      ? Date.parse(quote.expires_at)
      : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    const isIdempotentReplay = await isConfirmedLocalAirportReplay({
      merchantId,
      requestIdempotencyKey,
      supabase,
    });
    if (isIdempotentReplay) return true;

    throw new LocalAirportDeliveryValidationError(
      'The selected airport delivery quote has expired',
      'AIRPORT_QUOTE_EXPIRED',
      400
    );
  }

  const quotePrice = Number(quote.price);
  if (
    Number.isFinite(quotePrice) &&
    Math.abs(shippingFee - quotePrice) > 0.01
  ) {
    const isIdempotentReplay = await isConfirmedLocalAirportReplay({
      merchantId,
      requestIdempotencyKey,
      supabase,
    });
    if (isIdempotentReplay) return true;

    throw new LocalAirportDeliveryFeeMismatchError(shippingFee, quotePrice);
  }

  return false;
}

/** Validate fixed-fee airport delivery and airport-backed provider quotes. */
export async function validateLocalAirportDeliveryFee({
  airportType,
  deliveryMethod,
  merchantId,
  requestIdempotencyKey,
  selectedQuoteId,
  shippingAddress,
  shippingFee,
  shippingProvider,
  shippingRateId,
  source,
  supabase,
}: ValidateLocalAirportDeliveryFeeInput): Promise<LocalAirportDeliveryFeeValidationResult> {
  let resolvedDeliveryMethod = deliveryMethod;
  let resolvedAirportType = airportType;
  const legacyAirportType = getLegacyAirportType(shippingAddress?.address);
  const isLegacyMobileAirportDelivery = isLegacyMobileAirportDeliveryRequest({
    address: shippingAddress?.address,
    airportType,
    deliveryMethod,
    selectedQuoteId,
    shippingFee,
    shippingRateId,
    source,
  });
  if (
    legacyAirportType !== null &&
    deliveryMethod !== undefined &&
    (deliveryMethod !== 'airport' ||
      (airportType !== undefined && airportType !== legacyAirportType) ||
      (selectedQuoteId && legacyAirportType !== 'delivery'))
  ) {
    throw new LocalAirportDeliveryValidationError(
      'Delivery metadata conflicts with the airport address',
      'DELIVERY_METADATA_MISMATCH',
      400
    );
  }

  if (deliveryMethod === 'airport' && shippingRateId) {
    throw new LocalAirportDeliveryValidationError(
      'Merchant shipping rates cannot be used for airport delivery',
      'AIRPORT_QUOTE_INVALID',
      400
    );
  }

  // Provider-backed airport quotes cannot be relabeled as non-airport orders.
  if (selectedQuoteId && deliveryMethod !== 'airport') {
    const selectedQuoteIsAirport = await isSelectedAirportQuote({
      merchantId,
      selectedQuoteId,
      supabase,
    });
    if (selectedQuoteIsAirport) {
      if (deliveryMethod === undefined) {
        // Promote the server-verified quote discriminator for persistence.
        resolvedDeliveryMethod = 'airport';
        resolvedAirportType = 'delivery';
      } else {
        throw new LocalAirportDeliveryValidationError(
          'Airport provider quotes require airport delivery',
          'DELIVERY_METADATA_MISMATCH',
          400
        );
      }
    }
  }

  const resolvedDeliveryMetadata =
    deliveryMethod === undefined && resolvedDeliveryMethod === 'airport'
      ? {
          resolvedDeliveryMethod: 'airport' as const,
          resolvedAirportType: (resolvedAirportType ??
            'delivery') as AirportType,
        }
      : {};

  if (resolvedDeliveryMethod === 'airport' && selectedQuoteId) {
    if (resolvedAirportType === 'pickup') {
      throw new LocalAirportDeliveryValidationError(
        'Provider-backed airport quotes require airport delivery',
        'DELIVERY_METADATA_MISMATCH',
        400
      );
    }

    validateAirportDeliveryAddress({
      airportType: 'delivery',
      deliveryMethod: 'airport',
      selectedQuoteId,
      shippingAddress,
      shippingRateId,
    });

    const isIdempotentLocalAirportReplay = await validateSelectedAirportQuote({
      merchantId,
      requestIdempotencyKey,
      selectedQuoteId,
      shippingFee,
      shippingProvider,
      supabase,
    });
    return {
      ...resolvedDeliveryMetadata,
      isIdempotentLocalAirportReplay,
      localAirportShippingFee: null,
    };
  }

  validateAirportDeliveryAddress({
    airportType: resolvedAirportType,
    deliveryMethod: resolvedDeliveryMethod,
    selectedQuoteId,
    shippingAddress,
    shippingRateId,
  });

  const localAirportShippingFee = getLocalAirportDeliveryFee({
    airportType: resolvedAirportType,
    deliveryMethod: resolvedDeliveryMethod,
    selectedQuoteId,
    shippingAddress,
    shippingRateId,
  });
  // Promote fixed legacy markers after validation so v2 retries hash like explicit clients.
  const legacyFixedAirportMetadata = resolveLegacyAirportDeliveryMetadata({
    deliveryMethod,
    legacyAirportType,
    selectedQuoteId,
    shippingRateId,
  });
  if (
    localAirportShippingFee === null &&
    isAmbiguousMetadataFreeAirportFee({
      airportType: resolvedAirportType,
      deliveryMethod: resolvedDeliveryMethod,
      selectedQuoteId,
      shippingFee,
      shippingRateId,
    })
  ) {
    const isIdempotentLocalAirportReplay = await isConfirmedLocalAirportReplay({
      merchantId,
      requestIdempotencyKey,
      supabase,
    });
    if (!isIdempotentLocalAirportReplay) {
      throw new LocalAirportDeliveryValidationError(
        'Delivery metadata is required for this checkout amount',
        'DELIVERY_METADATA_REQUIRED',
        400
      );
    }
    return {
      isIdempotentLocalAirportReplay: true,
      localAirportShippingFee: null,
    };
  }

  const isIdempotentLocalAirportReplay = await validateLocalAirportFeeMismatch({
    isLegacyMobileAirportDelivery,
    localAirportShippingFee,
    merchantId,
    requestIdempotencyKey,
    shippingFee,
    supabase,
  });

  return {
    ...(legacyFixedAirportMetadata ?? resolvedDeliveryMetadata),
    isIdempotentLocalAirportReplay,
    localAirportShippingFee,
  };
}
