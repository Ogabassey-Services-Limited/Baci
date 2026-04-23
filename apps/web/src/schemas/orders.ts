import { z } from 'zod';
import { formatPersonName } from '@/lib/format-person-name';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
  sanitizeUrl,
} from '@/lib/sanitize-core';

const optionalHttpUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === '' ? undefined : trimmedValue;
  },
  z
    .string()
    .url({
      message: 'Invalid URL',
    })
    .max(2048)
    .refine(
      (value) => {
        const protocol = new URL(value).protocol;

        return protocol === 'http:' || protocol === 'https:';
      },
      {
        message: 'URL must use http or https',
      }
    )
    .transform((value) => sanitizeUrl(value))
    .refine((value) => value.length > 0, {
      message: 'Invalid URL',
    })
    .optional()
);

const orderCreateSchemaBase = z.object({
  merchant_id: z.string().uuid(),
  customer_email: z
    .string()
    .email()
    .transform((val) => sanitizeEmail(val)),
  customer_name: z
    .string()
    .min(1)
    .transform((val) => formatPersonName(sanitizeText(val))),
  customer_phone: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizePhone(val) : val)),
  items: z
    .array(
      z
        .object({
          product_id: z.string().optional(),
          productId: z.string().optional(),
          id: z.string().optional(),
          name: z
            .string()
            .min(1)
            .transform((val) => sanitizeText(val)),
          productName: z
            .string()
            .optional()
            .transform((val) => (val ? sanitizeText(val) : val)),
          quantity: z.number().int().positive(),
          price: z.number().nonnegative(),
          negotiatedPrice: z.number().nonnegative().optional(),
          value: z.number().nonnegative().optional(),
          imageUrl: optionalHttpUrlSchema,
          image_url: optionalHttpUrlSchema,
          has_assurance: z.boolean().optional(),
          assurance_fee: z.number().nonnegative().optional(),
          condition: z
            .string()
            .optional()
            .transform((val) =>
              val
                ? sanitizeText(val)
                    .trim()
                    .toLowerCase()
                    .replace(/[\s-]+/g, '_')
                : val
            ),
          variantId: z.string().optional(),
          variant_id: z.string().optional(),
          variantAttributes: z
            .record(
              z.string(),
              z.string().transform((val) => sanitizeText(val).trim())
            )
            .optional(),
          variant_attributes: z
            .record(
              z.string(),
              z.string().transform((val) => sanitizeText(val).trim())
            )
            .optional(),
        })
        .refine((data) => data.product_id || data.productId || data.id, {
          message:
            'At least one product identifier (product_id, productId, or id) is required',
        })
        .refine(
          (data) =>
            !data.imageUrl ||
            !data.image_url ||
            data.imageUrl === data.image_url,
          {
            message: 'imageUrl and image_url must match when both are provided',
          }
        )
    )
    .min(1),
  subtotal: z.coerce.number().nonnegative(),
  shipping_fee: z.coerce.number().nonnegative().default(0),
  discount_amount: z.coerce.number().nonnegative().default(0),
  tax_amount: z.coerce.number().nonnegative().default(0),
  payment_method: z
    .string()
    .min(1)
    .transform((val) => sanitizeText(val)),
  payment_status: z.string().default('unpaid'),
  shipping_status: z.string().default('pending'),
  shipping_address: z
    .object({
      address: z
        .string()
        .min(1)
        .transform((val) => sanitizeText(val)),
      city: z
        .string()
        .optional()
        .transform((val) => (val ? sanitizeText(val) : val)),
      state: z
        .string()
        .optional()
        .transform((val) => (val ? sanitizeText(val) : val)),
    })
    .optional(),
  source: z
    .string()
    .default('online_store')
    .transform((val) => sanitizeText(val)),
  notes: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val) : val)),
  ad_tracking: z
    .object({
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      userIp: z.string().optional(),
      userAgent: z.string().optional(),
      limitedDataUse: z.boolean().optional(),
    })
    // Opaque tracking fields may be forwarded to third-party analytics.
    .passthrough()
    .optional(),
  use_wallet_credit: z.boolean().default(false),
  wallet_amount: z.number().default(0),
  user_id: z.string().uuid().optional(),
  // Shipping metadata
  selected_quote_id: z.string().uuid().optional(),
  shipping_provider: z.string().optional(),
  tracking_number: z.string().optional(),
  // Legacy/Optional fields
  shipping_provider_legacy: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val) : val)),
});

export const orderCreateSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const data = input as Record<string, unknown>;

  return {
    ...data,
    selected_quote_id: data.selected_quote_id ?? data.shipping_quote_id,
  };
}, orderCreateSchemaBase);

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const reuseCheckoutOrderSchema = z.object({
  order_id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  tracking_token: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeText(value, 128) : value),
    z.string().min(1)
  ),
  customer_email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeEmail(value) : value),
    z.string().email()
  ),
  payment_method: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeText(value) : value),
    z.string().min(1)
  ),
  selected_quote_id: z.string().uuid().optional(),
  shipping_provider: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val) : val)),
});

export type ReuseCheckoutOrderInput = z.infer<typeof reuseCheckoutOrderSchema>;

export const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  payment_method: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((val) => sanitizeText(val ?? 'manual', 50)),
  reference: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val, 100) : val)),
  notes: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val, 500) : val)),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
