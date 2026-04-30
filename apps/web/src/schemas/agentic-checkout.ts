import { z } from 'zod';

export const agenticCheckoutItemSchema = z.object({
  id: z.string().trim().min(1, 'Item id is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const agenticCheckoutItemsSchema = z
  .array(agenticCheckoutItemSchema)
  .min(1, 'At least one item is required');

export const agenticFulfillmentAddressSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(7).optional(),
  address: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(2).max(3).optional(),
  postal_code: z.string().trim().min(1).optional(),
  station_id: z.number().int().nonnegative().optional(),
});

export const checkoutSessionSchema = z.object({
  items: agenticCheckoutItemsSchema,
  shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
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
    shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
    fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.items !== undefined ||
      value.shipping_address !== undefined ||
      value.fulfillment_option_id !== undefined,
    {
      message:
        'At least one of items, shipping_address, or fulfillment_option_id is required',
    }
  );

export const agenticCheckoutBuyerSchema = z.object({
  email: z.string().email(),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone_number: z.string().trim().min(7),
});

const humanConfirmationSchema = z.object({
  amount: z.number().int().nonnegative(),
  confirmed_at: z.string().datetime(),
  currency: z.string().trim().length(3).transform(toUppercaseCurrency),
  session_id: z.string().trim().min(1),
  signature: z.string().trim().min(32),
  type: z.literal('human_confirmation'),
});

const paymentMandateSchema = z.object({
  currency: z.string().trim().length(3).transform(toUppercaseCurrency),
  expires_at: z.string().datetime(),
  mandate_id: z.string().trim().min(1),
  max_amount: z.number().int().nonnegative(),
  session_id: z.string().trim().min(1).optional(),
  signature: z.string().trim().min(32),
  type: z.literal('payment_mandate'),
});

export const agenticCheckoutCompleteSchema = z.object({
  buyer: agenticCheckoutBuyerSchema,
  payment_data: z.object({
    billing_address: agenticFulfillmentAddressSchema.optional(),
    provider: z.literal('paystack'),
    token: z.string().trim().min(1),
  }),
  completion_authorization: z
    .union([humanConfirmationSchema, paymentMandateSchema])
    .nullish(),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
export type AgenticCheckoutUpdateInput = z.infer<
  typeof agenticCheckoutUpdateSchema
>;
export type AgenticCheckoutCompleteInput = z.infer<
  typeof agenticCheckoutCompleteSchema
>;

function toUppercaseCurrency(value: string) {
  return value.toUpperCase();
}
