import type { ShipmentTrackingStatus } from '@baci/shared/schemas';
import type { ShippingProviderCode } from './types';

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  timestamp: Date;
  rawStatus?: string;
  providerEventId?: string;
  providerEventKey?: string;
}

export interface TrackingResult {
  provider: ShippingProviderCode;
  trackingNumber: string;
  status: NormalizedShipmentStatus;
  carrierName: string;
  hasRecognizedLifecycleEvent?: boolean;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  events: TrackingEvent[];
  isStationPickup?: boolean;
  pickupStationName?: string;
  pickupStationAddress?: string;
}

export type NormalizedShipmentStatus = ShipmentTrackingStatus;

export const SHIPMENT_STATUS_LABELS: Record<NormalizedShipmentStatus, string> =
  {
    pending: 'Pending',
    booked: 'Booked',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    failed: 'Failed',
    returned: 'Returned',
  };
