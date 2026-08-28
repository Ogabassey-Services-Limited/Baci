import { getLegacyAirportType } from '@/lib/checkout/airport-delivery-legacy-marker';
import { LocalAirportDeliveryValidationError } from '@/lib/checkout/local-airport-delivery-validation-error';

interface AirportDeliveryAddress {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface ValidateAirportDeliveryAddressInput {
  airportType?: 'delivery' | 'pickup';
  deliveryMethod?: string;
  selectedQuoteId?: string | null;
  shippingAddress?: AirportDeliveryAddress | null;
  shippingRateId?: string | null;
}

export function validateAirportDeliveryAddress({
  airportType,
  deliveryMethod,
  selectedQuoteId,
  shippingAddress,
  shippingRateId,
}: ValidateAirportDeliveryAddressInput): void {
  const normalizedCity = shippingAddress?.city?.trim().toLowerCase();
  const normalizedState = shippingAddress?.state?.trim().toLowerCase();
  const hasSyntheticDestination =
    normalizedCity === 'airport' && normalizedState === 'nigeria';
  const hasLegacyMarkerAddress =
    getLegacyAirportType(shippingAddress?.address) === 'delivery';

  if (
    deliveryMethod !== 'airport' ||
    airportType !== 'delivery' ||
    selectedQuoteId ||
    shippingRateId ||
    (shippingAddress?.address?.trim() &&
      shippingAddress.city?.trim() &&
      shippingAddress.state?.trim() &&
      !hasSyntheticDestination &&
      !hasLegacyMarkerAddress)
  ) {
    return;
  }

  throw new LocalAirportDeliveryValidationError(
    'A delivery address is required for local airport delivery',
    'AIRPORT_ADDRESS_REQUIRED',
    400
  );
}
