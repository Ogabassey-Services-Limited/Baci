import { AIRPORT_DELIVERY_FEES } from '@baci/shared/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  GiglDeliveryType,
  PickupOptions,
  parseGiglProviderRateId,
} from '@/lib/shipping/providers/gigl.constants';
import { getLocalAirportDeliveryFee } from './airport-delivery-fee';
import { LocalAirportDeliveryFeeMismatchError } from './local-airport-delivery-fee-mismatch-error';
import type { LocalAirportDeliveryFeeValidationResult } from './local-airport-delivery-fee-validation-result';
import { LocalAirportDeliveryValidationError } from './local-airport-delivery-validation-error';

type AirportType = 'delivery' | 'pickup';

// Before delivery metadata shipped, local airport delivery used ₦25,000.
// A metadata-free request at that amount is ambiguous with a non-airport
// merchant fee, so it must be rejected unless it is a confirmed idempotent
// replay. The current pickup fee is also included because it remains a valid
// fixed airport amount with no metadata discriminator.
const LEGACY_AIRPORT_DELIVERY_FEE = 25_000;

function isAmbiguousMetadataFreeAirportFee({
  airportType,
  deliveryMethod,
  selectedQuoteId,
  shippingFee,
  shippingRateId,
}: Pick<
  ValidateLocalAirportDeliveryFeeInput,
  | 'airportType'
  | 'deliveryMethod'
  | 'selectedQuoteId'
  | 'shippingFee'
  | 'shippingRateId'
>) {
  return (
    deliveryMethod === undefined &&
    airportType === undefined &&
    !selectedQuoteId &&
    !shippingRateId &&
    (Math.abs(shippingFee - LEGACY_AIRPORT_DELIVERY_FEE) <= 0.01 ||
      Math.abs(shippingFee - AIRPORT_DELIVERY_FEES.pickup) <= 0.01)
  );
}

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

async function isConfirmedLocalAirportReplay({
  merchantId,
  requestIdempotencyKey,
  supabase,
}: Pick<
  ValidateLocalAirportDeliveryFeeInput,
  'merchantId' | 'requestIdempotencyKey' | 'supabase'
>): Promise<boolean> {
  if (!requestIdempotencyKey) return false;

  const { data, error } = await supabase.rpc(
    'has_storefront_order_idempotency_key',
    {
      p_checkout_idempotency_key: requestIdempotencyKey,
      p_merchant_id: merchantId,
    }
  );
  if (error) {
    logger.warn({
      message:
        'Idempotent local-airport order pre-check failed; rejecting the stale fee',
      merchantId,
      error,
    });
    return false;
  }

  return data === true;
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
