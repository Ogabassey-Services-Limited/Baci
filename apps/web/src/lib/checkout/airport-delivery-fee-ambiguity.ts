import {
  AIRPORT_DELIVERY_FEES,
  LEGACY_AIRPORT_DELIVERY_FEE,
} from '@baci/shared/constants';

type AirportType = 'delivery' | 'pickup';

type MetadataFreeAirportFeeInput = Readonly<{
  airportType?: AirportType;
  deliveryMethod?: string;
  selectedQuoteId?: string | null;
  shippingFee: number;
  shippingRateId?: string | null;
}>;

/**
 * Identifies the legacy fixed amounts that are ambiguous without metadata.
 * The amount is only used to require a durable discriminator or a confirmed
 * idempotent replay; it never classifies the order as airport delivery.
 */
export function isAmbiguousMetadataFreeAirportFee({
  airportType,
  deliveryMethod,
  selectedQuoteId,
  shippingFee,
  shippingRateId,
}: MetadataFreeAirportFeeInput): boolean {
  return (
    deliveryMethod === undefined &&
    airportType === undefined &&
    !selectedQuoteId &&
    !shippingRateId &&
    (Math.abs(shippingFee - LEGACY_AIRPORT_DELIVERY_FEE) <= 0.01 ||
      Math.abs(shippingFee - AIRPORT_DELIVERY_FEES.delivery) <= 0.01 ||
      Math.abs(shippingFee - AIRPORT_DELIVERY_FEES.pickup) <= 0.01)
  );
}
