import { z } from 'zod';

const snapshotTextSchema = z
  .string()
  .transform((value) => value.trim() || null)
  .nullable()
  .optional();

const shipmentMetadataSchema = z.object({
  fulfillment_courier_name: snapshotTextSchema,
  fulfillment_tracking_number: snapshotTextSchema,
  fulfillment_tracking_token: snapshotTextSchema,
  manual_courier_name: z.string().trim().min(1).optional(),
  manual_estimated_delivery: z.string().trim().min(1).optional(),
  manual_tracking_number: z.string().trim().min(1).optional(),
});

export function resolveOrderNotificationOutboxShipmentMetadata(
  metadata: Record<string, unknown> | undefined
) {
  const parsed = shipmentMetadataSchema.safeParse(metadata);
  if (!parsed.success) return {};

  return {
    courierName:
      parsed.data.manual_courier_name ??
      ('fulfillment_courier_name' in parsed.data
        ? parsed.data.fulfillment_courier_name
        : undefined),
    estimatedDelivery: parsed.data.manual_estimated_delivery,
    trackingNumber:
      parsed.data.manual_tracking_number ??
      ('fulfillment_tracking_number' in parsed.data
        ? parsed.data.fulfillment_tracking_number
        : undefined),
    trackingToken:
      'fulfillment_tracking_token' in parsed.data
        ? parsed.data.fulfillment_tracking_token
        : undefined,
  };
}
