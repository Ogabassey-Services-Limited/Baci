import { z } from 'zod';

const ucpCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
  .transform((value) => value.toUpperCase());

export const ucpCartLineItemSchema = z
  .object({
    item: z
      .object({
        id: z.string().trim().min(1, 'Item id is required'),
      })
      .passthrough(),
    quantity: z.number().int().positive('Quantity must be positive'),
  })
  .passthrough();

export const ucpPostalAddressSchema = z
  .object({
    address_country: z.string().trim().min(1).optional(),
    address_locality: z.string().trim().min(1).optional(),
    address_region: z.string().trim().min(1).optional(),
    extended_address: z.string().trim().min(1).optional(),
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
    phone_number: z.string().trim().min(1).optional(),
    postal_code: z.string().trim().min(1).optional(),
    street_address: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const ucpBuyerSchema = z
  .object({
    email: z.string().trim().email().optional(),
    name: z.string().trim().min(1).optional(),
    phone_number: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const ucpCartCreateRequestSchema = z
  .object({
    buyer: ucpBuyerSchema.optional(),
    currency: ucpCurrencySchema.optional().default('NGN'),
    line_items: z.array(ucpCartLineItemSchema).min(1),
    shipping_address: ucpPostalAddressSchema.nullable().optional(),
  })
  .passthrough();

const ucpCartUpdateFieldsSchema = z.object({
  buyer: ucpBuyerSchema.optional(),
  currency: ucpCurrencySchema.optional(),
  line_items: z.array(ucpCartLineItemSchema).min(1).optional(),
  shipping_address: ucpPostalAddressSchema.nullable().optional(),
});

export const ucpCartUpdateRequestSchema = ucpCartUpdateFieldsSchema
  .passthrough()
  .refine(
    (payload) =>
      payload.buyer !== undefined ||
      payload.currency !== undefined ||
      payload.line_items !== undefined ||
      payload.shipping_address !== undefined,
    { message: 'Cart update requires at least one mutable field' }
  );

export type UcpCartCreateRequest = z.infer<typeof ucpCartCreateRequestSchema>;
export type UcpCartLineItem = z.infer<typeof ucpCartLineItemSchema>;
export type UcpCartUpdateRequest = z.infer<typeof ucpCartUpdateRequestSchema>;
export type UcpPostalAddress = z.infer<typeof ucpPostalAddressSchema>;
