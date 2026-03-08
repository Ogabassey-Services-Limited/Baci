import { z } from 'zod';

export const agenticCheckoutItemSchema = z.object({
  id: z.string().trim().min(1, 'Item id is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const agenticFulfillmentAddressSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    countryCode: z.string().min(2).max(3).optional(),
    postalCode: z.string().min(1).optional(),
    stationId: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const checkoutSessionSchema = z.object({
  items: z
    .array(agenticCheckoutItemSchema)
    .min(1, 'At least one item is required'),
  fulfillment_address: agenticFulfillmentAddressSchema.nullable().optional(),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase())
    .optional()
    .default('NGN'),
});

export const agenticCheckoutUpdateSchema = z
  .object({
    items: z.array(agenticCheckoutItemSchema).min(1).optional(),
    fulfillment_address: agenticFulfillmentAddressSchema.nullable().optional(),
    fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.items !== undefined ||
      value.fulfillment_address !== undefined ||
      value.fulfillment_option_id !== undefined,
    {
      message:
        'At least one of items, fulfillment_address, or fulfillment_option_id is required',
    }
  );

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
export type AgenticCheckoutUpdateInput = z.infer<
  typeof agenticCheckoutUpdateSchema
>;
