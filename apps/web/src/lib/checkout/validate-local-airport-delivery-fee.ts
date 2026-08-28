import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  GiglDeliveryType,
  PickupOptions,
  parseGiglProviderRateId,
} from '@/lib/shipping/providers/gigl.constants';
import { getLocalAirportDeliveryFee } from './airport-delivery-fee';
import { isAmbiguousMetadataFreeAirportFee } from './airport-delivery-fee-ambiguity';
import { getLegacyAirportType } from './airport-delivery-legacy-marker';
import { isConfirmedLocalAirportReplay } from './is-confirmed-local-airport-replay';
import { LocalAirportDeliveryFeeMismatchError } from './local-airport-delivery-fee-mismatch-error';
import type { LocalAirportDeliveryFeeValidationResult } from './local-airport-delivery-fee-validation-result';
import { LocalAirportDeliveryValidationError } from './local-airport-delivery-validation-error';

type AirportType = 'delivery' | 'pickup';

interface AirportQuoteRecord {
  expires_at?: unknown;
  price?: unknown;
  provider?: unknown;
  provider_rate_id?: unknown;
}

interface ValidateLocalAirportDeliveryFeeInput {
  airportType?: AirportType;
  deliveryMethod?: string;
  merchantId: string;
  requestIdempotencyKey?: string | null;
  selectedQuoteId?: string | null;
  shippingAddress?: { address?: string | null } | null;
  shippingFee: number;
  shippingProvider?: string | null;
  shippingRateId?: string | null;
  supabase: SupabaseClient;
}

function asAirportQuoteRecord(value: unknown): AirportQuoteRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as AirportQuoteRecord;
}

function readAirportQuote(data: unknown): AirportQuoteRecord | null {
  if (Array.isArray(data)) {
    return asAirportQuoteRecord(data[0]);
  }

  return asAirportQuoteRecord(data);
}

function isEligibleAirportQuote(
  quote: AirportQuoteRecord,
  shippingProvider: string | null | undefined
): boolean {
  const provider =
    typeof quote.provider === 'string'
      ? quote.provider.trim().toUpperCase()
      : '';
  const providerRateId =
    typeof quote.provider_rate_id === 'string'
      ? quote.provider_rate_id.trim()
      : '';
  const serviceTier =
    typeof (quote as Record<string, unknown>).service_tier === 'string'
      ? String((quote as Record<string, unknown>).service_tier)
          .trim()
          .toLowerCase()
      : null;
  const parsedRate = parseGiglProviderRateId(providerRateId);
  const normalizedShippingProvider = shippingProvider?.trim().toUpperCase();

  return (
    provider === 'GIGL' &&
    parsedRate.pickupOption === PickupOptions.HomeDelivery &&
    parsedRate.deliveryType === GiglDeliveryType.GoFaster &&
    (serviceTier === null || serviceTier.includes('gofaster')) &&
    normalizedShippingProvider === provider
  );
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
