import { LocalAirportDeliveryValidationError } from './local-airport-delivery-validation-error';

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
  if (
    deliveryMethod !== 'airport' ||
    airportType !== 'delivery' ||
    selectedQuoteId ||
    shippingRateId ||
    (shippingAddress?.address?.trim() &&
      shippingAddress.city?.trim() &&
      shippingAddress.state?.trim())
  ) {
    return;
  }

  throw new LocalAirportDeliveryValidationError(
    'A delivery address is required for local airport delivery',
    'AIRPORT_ADDRESS_REQUIRED',
    400
  );
}
