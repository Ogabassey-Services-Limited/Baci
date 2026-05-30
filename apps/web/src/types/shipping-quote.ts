export interface ShippingQuote {
  id: string;
  provider: string;
  serviceTier: string;
  carrierName: string;
  displayName: string;
  estimatedDays: number;
  deliveryRange?: string;
  minDays?: number;
  maxDays?: number;
  price: number;
  currency: string;
  pickupIncluded?: boolean;
  insuranceIncluded?: boolean;
  isStationPickup?: boolean;
  stationName?: string;
  stationAddress?: string;
  providerRateId?: string;
}
