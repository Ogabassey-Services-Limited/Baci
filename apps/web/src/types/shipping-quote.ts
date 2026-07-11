import type { ShippingProviderCode } from '@/lib/shipping/types';

export interface ShippingQuote {
  id: string;
  provider: ShippingProviderCode;
  serviceTier: string;
  carrierName: string;
  displayName: string;
  estimatedDays: number;
  deliveryRange?: string;
  minDays?: number;
  maxDays?: number;
  price: number;
  currency: string;
  pickupIncluded: boolean;
  insuranceIncluded: boolean;
  isStationPickup?: boolean;
  stationName?: string;
  stationAddress?: string;
  stationCode?: string;
  providerRateId?: string;
}
