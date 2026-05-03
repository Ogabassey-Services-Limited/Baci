export type DeliveryMethod = 'door' | 'airport' | 'pickup_station';

export interface ShippingQuote {
  id: string | number;
  displayName: string;
  price: number;
  carrierName?: string;
  provider?: string;
  estimatedDays?: number;
  deliveryRange?: string;
  serviceTier?: string;
  isStationPickup?: boolean;
}
