export interface LocalAirportDeliveryFeeValidationResult {
  isIdempotentLocalAirportReplay: boolean;
  localAirportShippingFee: number | null;
}
