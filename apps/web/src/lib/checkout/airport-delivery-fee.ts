import { AIRPORT_DELIVERY_FEES } from '@baci/shared/constants';

type AirportType = keyof typeof AIRPORT_DELIVERY_FEES;

interface LocalAirportDeliveryFeeInput {
  airportType?: AirportType;
  deliveryMethod?: string;
  selectedQuoteId?: string | null;
  shippingAddress?: { address?: string | null } | null;
  shippingRateId?: string | null;
}

function getLegacyAirportType(address?: string | null): AirportType | null {
  const normalized = address?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'airport pickup') return 'pickup';
  if (
    normalized === 'airport delivery' ||
    normalized === 'airport delivery (outside lagos)'
  ) {
    return 'delivery';
  }
  return null;
}

/**
 * Resolve the server-owned fee for a local airport order.
 *
 * Provider-backed airport quotes and merchant-configured rates have their own
 * server verification paths, so this returns null for either selected id.
 * The exact legacy address markers preserve protection for older mobile builds
 * that did not yet send delivery metadata.
 */
export function getLocalAirportDeliveryFee({
  airportType,
  deliveryMethod,
  selectedQuoteId,
  shippingAddress,
  shippingRateId,
}: LocalAirportDeliveryFeeInput): number | null {
  if (selectedQuoteId || shippingRateId) return null;

  const legacyAirportType = getLegacyAirportType(shippingAddress?.address);
  if (deliveryMethod !== 'airport' && legacyAirportType === null) return null;

  const resolvedAirportType =
    deliveryMethod === 'airport'
      ? (airportType ?? 'delivery')
      : legacyAirportType;
  if (resolvedAirportType === null) return null;
  return AIRPORT_DELIVERY_FEES[resolvedAirportType];
}
