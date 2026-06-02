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

const ucpCheckoutLineItemRequestSchema = z.looseObject({
  item: z.looseObject({
    id: z.string().trim().min(1),
  }),
  quantity: z.int().positive(),
});

const ucpPaymentCredentialSchema = z.looseObject({
  type: z.string().trim().min(1),
});

const ucpPaymentInstrumentDisplaySchema = z.looseObject({});

const ucpPostalAddressSchema = z
  .looseObject({
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
  .refine(
    (payload) =>
      UCP_POSTAL_ADDRESS_FIELDS.some((field) => {
        const value = payload[field];
        return (
          value !== undefined &&
          (typeof value !== 'string' || value.trim().length > 0)
        );
      }),
    {
      error: 'At least one address field is required',
    }
  );

const ucpPaymentInstrumentSchema = z.looseObject({
  billing_address: ucpPostalAddressSchema.optional(),
  credential: ucpPaymentCredentialSchema.optional(),
  display: ucpPaymentInstrumentDisplaySchema.optional(),
  handler_id: z.string().trim().min(1),
  id: z.string().trim().min(1),
  selected: z.boolean().optional(),
  type: z.string().trim().min(1),
});

export const ucpCheckoutCreateRequestSchema = z.looseObject({
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase())
    .optional(),
  line_items: z.array(ucpCheckoutLineItemRequestSchema).min(1),
  shipping_address: ucpPostalAddressSchema.nullable().optional(),
});

export const ucpCheckoutUpdateRequestSchema = z.looseObject({
  fulfillment_option_id: z.string().trim().min(1).nullable().optional(),
  line_items: z.array(ucpCheckoutLineItemRequestSchema).min(1),
  shipping_address: ucpPostalAddressSchema.nullable().optional(),
});

export const ucpCheckoutCompleteRequestSchema = z
  .looseObject({
    payment: z.looseObject({
      instruments: z.array(ucpPaymentInstrumentSchema).min(1),
    }),
  })
  .superRefine((payload, context) => {
    const selectedCount = payload.payment.instruments.filter(
      (instrument) => instrument.selected === true
    ).length;
    if (selectedCount > 1) {
      context.addIssue({
        code: 'custom',
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
