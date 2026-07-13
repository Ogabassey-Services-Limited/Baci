import { z } from 'zod';

const merchant = z.object({
  id: z.string().min(1),
  business_name: z.string().min(1),
  slug: z.string().min(1),
  support_email: z.string().nullable(),
  email_sender_name: z.string().nullable(),
  email: z.string().nullable(),
  tax_identification_number: z.string().nullable().optional(),
  cac_rc_number: z.string().nullable().optional(),
});

const shippingStatus = z.enum([
  'pending',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'canceled',
  'returned',
  'failed',
]);

const shippingAddress = z.union([
  z.object({
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
  }),
  z.string().transform((address) => ({ address })),
]);

const order = z.object({
  id: z.string().min(1),
  customer_id: z.string().nullable().optional(),
  order_number: z.string().nullable(),
  customer_name: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value || 'Customer'),
  customer_email: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  shipping_status: shippingStatus,
  shipping_provider: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  tracking_token: z.string().nullable().optional(),
  shipping_address: shippingAddress.nullable().optional(),
  order_items: z
    .array(
      z.object({
        name: z.string().nullable(),
        quantity: z.number().nullable(),
      })
    )
    .nullable(),
});

const featureSettings = z.object({
  google_place_id: z.string().nullable(),
});

export const orderFulfillmentNotificationSchemas = {
  featureSettings,
  merchant,
  order,
};
