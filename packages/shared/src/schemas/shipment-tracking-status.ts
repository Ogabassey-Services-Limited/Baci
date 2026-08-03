import { z } from 'zod';

export const shipmentTrackingStatusSchema = z.enum([
  'pending',
  'booked',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'failed',
  'returned',
]);

export type ShipmentTrackingStatus = z.infer<
  typeof shipmentTrackingStatusSchema
>;
