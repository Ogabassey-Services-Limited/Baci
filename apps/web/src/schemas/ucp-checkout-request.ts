import { z } from 'zod';
import { agenticFulfillmentAddressSchema } from '@/schemas/agentic-checkout';

const ucpCheckoutLineItemRequestSchema = z
  .object({
    item: z
      .object({
        id: z.string().trim().min(1),
      })
      .passthrough(),
    quantity: z.number().int().positive(),
  })
  .passthrough();

export const ucpCheckoutCreateRequestSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
      .transform((value) => value.toUpperCase())
      .optional(),
    line_items: z.array(ucpCheckoutLineItemRequestSchema).min(1),
    shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
  })
  .passthrough();

export const ucpCheckoutUpdateRequestSchema = z
  .object({
    fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
    line_items: z.array(ucpCheckoutLineItemRequestSchema).min(1),
    shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
  })
  .passthrough();

export type UcpCheckoutCreateRequest = z.infer<
  typeof ucpCheckoutCreateRequestSchema
>;
export type UcpCheckoutUpdateRequest = z.infer<
  typeof ucpCheckoutUpdateRequestSchema
>;
