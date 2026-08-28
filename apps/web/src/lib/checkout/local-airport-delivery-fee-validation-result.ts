export interface LocalAirportDeliveryFeeValidationResult {
  isIdempotentLocalAirportReplay: boolean;
  localAirportShippingFee: number | null;
  resolvedDeliveryMethod?: 'airport';
  resolvedAirportType?: 'delivery';
}
