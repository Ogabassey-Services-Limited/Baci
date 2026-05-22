import { z } from 'zod';
import {
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_PROVIDER_PAYSTACK,
} from '../config/agentic-payment-methods';

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

const checkoutSessionBaseSchema = z.object({
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

export const checkoutSessionSchema = z.preprocess(
  normalizeCheckoutLineItemsAlias,
  checkoutSessionBaseSchema
);

const createAgenticCheckoutSessionItemSchema = agenticCheckoutItemSchema.extend(
  {
    quantity: z
      .number()
      .int()
      .positive('Quantity must be a positive integer')
      .max(20, 'Quantity must be 20 or less'),
  }
);

export const createAgenticCheckoutSessionInputSchema = z.preprocess(
  normalizeCheckoutLineItemsAlias,
  checkoutSessionBaseSchema.extend({
    idempotency_key: z.string().trim().min(8).max(128).optional(),
    items: z.array(createAgenticCheckoutSessionItemSchema).min(1).max(50),
  })
);

const agenticCheckoutUpdateBaseSchema = z
  .object({
    items: agenticCheckoutItemsSchema.optional(),
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

export const agenticCheckoutUpdateSchema = z.preprocess(
  normalizeCheckoutLineItemsAlias,
  agenticCheckoutUpdateBaseSchema
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

// Paystack provider accepts either the canonical name (`paystack`) or the
// manifest-advertised method name (`paystack_bank_transfer`) as an alias, and
// normalizes the parsed value to the canonical `paystack` so downstream code
// can keep its `provider === 'paystack'` checks unchanged.
const paystackPaymentDataSchema = z
  .object({
    billing_address: agenticFulfillmentAddressSchema.optional(),
    provider: z
      .union([
        z.literal(AGENTIC_PAYMENT_PROVIDER_PAYSTACK),
        z.literal(AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER),
      ])
      .transform(() => AGENTIC_PAYMENT_PROVIDER_PAYSTACK),
    token: z.string().trim().min(1),
  })
  .strict();

const payOnDeliveryPaymentDataSchema = z
  .object({
    billing_address: agenticFulfillmentAddressSchema.optional(),
    provider: z.literal(AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY),
  })
  .strict();

export const agenticPaymentDataSchema = z.union([
  paystackPaymentDataSchema,
  payOnDeliveryPaymentDataSchema,
]);

export const agenticCheckoutCompleteSchema = z.object({
  buyer: agenticCheckoutBuyerSchema,
  payment_data: agenticPaymentDataSchema,
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

function normalizeCheckoutLineItemsAlias(value: unknown): unknown {
  if (
    !isRecord(value) ||
    Object.hasOwn(value, 'items') ||
    !Object.hasOwn(value, 'line_items')
  ) {
    return value;
  }

  return {
    ...value,
    items: value.line_items,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
