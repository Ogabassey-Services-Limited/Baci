import { z } from 'zod';

const UCP_POSTAL_ADDRESS_FIELDS = [
  'street_address',
  'extended_address',
  'address_locality',
  'address_region',
  'address_country',
  'postal_code',
  'first_name',
  'last_name',
  'phone_number',
] as const;

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

const ucpPaymentCredentialSchema = z
  .object({
    type: z.string().trim().min(1),
  })
  .passthrough();

const ucpPaymentInstrumentDisplaySchema = z.object({}).passthrough();

const ucpPostalAddressSchema = z
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
  .passthrough()
  .refine(
    (payload) =>
      UCP_POSTAL_ADDRESS_FIELDS.some((field) => {
        const value = payload[field];
        return (
          value !== undefined &&
          (typeof value !== 'string' || value.trim().length > 0)
        );
      }),
    { message: 'At least one address field is required' }
  );

const ucpPaymentInstrumentSchema = z
  .object({
    billing_address: ucpPostalAddressSchema.optional(),
    credential: ucpPaymentCredentialSchema.optional(),
    display: ucpPaymentInstrumentDisplaySchema.optional(),
    handler_id: z.string().trim().min(1),
    id: z.string().trim().min(1),
    selected: z.boolean().optional(),
    type: z.string().trim().min(1),
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
    shipping_address: ucpPostalAddressSchema.nullable().optional(),
  })
  .passthrough();

export const ucpCheckoutUpdateRequestSchema = z
  .object({
    fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
    line_items: z.array(ucpCheckoutLineItemRequestSchema).min(1),
    shipping_address: ucpPostalAddressSchema.nullable().optional(),
  })
  .passthrough();

export const ucpCheckoutCompleteRequestSchema = z
  .object({
    payment: z
      .object({
        instruments: z.array(ucpPaymentInstrumentSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((payload, context) => {
    const selectedCount = payload.payment.instruments.filter(
      (instrument) => instrument.selected === true
    ).length;
    if (selectedCount > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only one payment instrument can be selected',
        path: ['payment', 'instruments'],
      });
    }
  });

export type UcpCheckoutCreateRequest = z.infer<
  typeof ucpCheckoutCreateRequestSchema
>;
export type UcpCheckoutUpdateRequest = z.infer<
  typeof ucpCheckoutUpdateRequestSchema
>;
export type UcpCheckoutCompleteRequest = z.infer<
  typeof ucpCheckoutCompleteRequestSchema
>;
