import {
  AIRPORT_DELIVERY_FEES,
  LEGACY_AIRPORT_DELIVERY_FEES,
} from '@baci/shared/constants';

type AirportType = keyof typeof AIRPORT_DELIVERY_FEES;

interface LocalAirportDeliveryFeeInput {
  airportType?: AirportType;
  deliveryMethod?: string;
  shippingFee?: number;
  selectedQuoteId?: string | null;
  shippingAddress?: { address?: string | null } | null;
  shippingRateId?: string | null;
}

function getLegacyAirportType(
  address: string | null | undefined,
  shippingFee: number | undefined
): AirportType | null {
  const normalized = address?.trim().toLowerCase();
  if (normalized) {
    if (normalized === 'airport pickup') return 'pickup';
    if (
      normalized === 'airport delivery' ||
      normalized === 'airport delivery (outside lagos)'
    ) {
      return 'delivery';
    }
  }

  // Pre-metadata web and mobile clients preserve a shopper-entered address,
  // so the placeholder marker is not reliable. Their fixed fee, combined
  // with the absence of a quote/rate id, is the remaining server-verifiable
  // signal for a legacy local airport order.
  if (shippingFee === LEGACY_AIRPORT_DELIVERY_FEES.pickup) return 'pickup';
  if (shippingFee === LEGACY_AIRPORT_DELIVERY_FEES.delivery) return 'delivery';
  return null;
}

/**
 * Resolve the server-owned fee for a local airport order.
 *
 * Provider-backed airport quotes and merchant-configured rates have their own
 * server verification paths, so this returns null for either selected id.
 * Older clients omit delivery metadata. Their historical fixed fee, combined
 * with the absence of a quote/rate id, preserves protection even when they
 * sent a real shopper-entered address instead of an airport placeholder.
 */
export function getLocalAirportDeliveryFee({
  airportType,
  deliveryMethod,
  shippingFee,
  selectedQuoteId,
  shippingAddress,
  shippingRateId,
}: LocalAirportDeliveryFeeInput): number | null {
  if (selectedQuoteId || shippingRateId) return null;

  if (deliveryMethod !== undefined && deliveryMethod !== 'airport') return null;

  const legacyAirportType = getLegacyAirportType(
    shippingAddress?.address,
    shippingFee
  );
  if (deliveryMethod === undefined && legacyAirportType === null) return null;

  const resolvedAirportType =
    deliveryMethod === 'airport'
      ? (airportType ?? 'delivery')
      : legacyAirportType;
  if (resolvedAirportType === null) return null;
  return AIRPORT_DELIVERY_FEES[resolvedAirportType];
}
