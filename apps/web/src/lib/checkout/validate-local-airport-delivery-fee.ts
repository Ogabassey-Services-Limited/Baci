import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAirportDeliveryAddress } from '@/lib/checkout/airport-delivery-address';
import { getLocalAirportDeliveryFee } from '@/lib/checkout/airport-delivery-fee';
import { isAmbiguousMetadataFreeAirportFee } from '@/lib/checkout/airport-delivery-fee-ambiguity';
import { getLegacyAirportType } from '@/lib/checkout/airport-delivery-legacy-marker';
import {
  isEligibleAirportQuote,
  readAirportQuote,
} from '@/lib/checkout/airport-delivery-quote-validation';
import { isConfirmedLocalAirportReplay } from '@/lib/checkout/is-confirmed-local-airport-replay';
import { LocalAirportDeliveryFeeMismatchError } from '@/lib/checkout/local-airport-delivery-fee-mismatch-error';
import type { LocalAirportDeliveryFeeValidationResult } from '@/lib/checkout/local-airport-delivery-fee-validation-result';
import { LocalAirportDeliveryValidationError } from '@/lib/checkout/local-airport-delivery-validation-error';
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

/**
 * Validate fixed-fee airport delivery and airport-backed provider quotes.
 *
 * The route delegates the complete money-path decision here so fixed-fee
 * enforcement, airport quote verification, and replay handling cannot drift
 * apart in the oversized order route.
 */
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
  supabase,
}: ValidateLocalAirportDeliveryFeeInput): Promise<LocalAirportDeliveryFeeValidationResult> {
  const legacyAirportType = getLegacyAirportType(shippingAddress?.address);
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

  if (deliveryMethod === 'airport' && selectedQuoteId) {
    const isIdempotentLocalAirportReplay = await validateSelectedAirportQuote({
      merchantId,
      requestIdempotencyKey,
      selectedQuoteId,
      shippingFee,
      shippingProvider,
      supabase,
    });
    return {
      isIdempotentLocalAirportReplay,
      localAirportShippingFee: null,
    };
  }

  validateAirportDeliveryAddress({
    airportType,
    deliveryMethod,
    selectedQuoteId,
    shippingAddress,
    shippingRateId,
  });

  const localAirportShippingFee = getLocalAirportDeliveryFee({
    airportType,
    deliveryMethod,
    selectedQuoteId,
    shippingAddress,
    shippingRateId,
  });

  if (
    localAirportShippingFee === null &&
    isAmbiguousMetadataFreeAirportFee({
      airportType,
      deliveryMethod,
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

  const localAirportShippingFeeMismatch =
    localAirportShippingFee !== null &&
    Math.abs(shippingFee - localAirportShippingFee) > 0.01;
  const isIdempotentLocalAirportReplay = localAirportShippingFeeMismatch
    ? await isConfirmedLocalAirportReplay({
        merchantId,
        requestIdempotencyKey,
        supabase,
      })
    : false;

  if (localAirportShippingFeeMismatch && !isIdempotentLocalAirportReplay) {
    logger.warn({
      message: 'Storefront order rejected: local airport shipping fee mismatch',
      clientShippingFee: shippingFee,
      serverShippingFee: localAirportShippingFee,
    });
    throw new LocalAirportDeliveryFeeMismatchError(
      shippingFee,
      localAirportShippingFee
    );
  }

  return {
    isIdempotentLocalAirportReplay,
    localAirportShippingFee,
  };
}
