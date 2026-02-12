import { z } from 'zod';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizePrice,
  sanitizeText,
} from '@/lib/sanitize-core';

export const orderCreateSchema = z.object({
  merchant_id: z.string().uuid(),
  customer_email: z.string().email().transform(sanitizeEmail),
  customer_name: z.string().min(1).transform(sanitizeText),
  customer_phone: z.string().transform(sanitizePhone).optional(),
  items: z
    .array(
      z
        .object({
          product_id: z.string().optional(),
          productId: z.string().optional(),
          id: z.string().optional(),
          name: z.string().min(1).transform(sanitizeText),
          productName: z.string().transform(sanitizeText).optional(),
          quantity: z.number().int().positive(),
          price: z.number().nonnegative().transform(sanitizePrice),
          negotiatedPrice: z
            .number()
            .nonnegative()
            .transform(sanitizePrice)
            .optional(),
          value: z.number().nonnegative().transform(sanitizePrice).optional(),
          has_assurance: z.boolean().optional(),
          assurance_fee: z
            .number()
            .nonnegative()
            .transform(sanitizePrice)
            .optional(),
          variantId: z.string().optional(),
          variant_id: z.string().optional(),
          variantAttributes: z.record(z.string()).optional(),
        })
        .refine((data) => data.product_id || data.productId || data.id, {
          message:
            'At least one product identifier (product_id, productId, or id) is required',
        })
    )
    .min(1),
  subtotal: z.coerce.number().nonnegative().transform(sanitizePrice),
  shipping_fee: z.coerce
    .number()
    .nonnegative()
    .default(0)
    .transform(sanitizePrice),
  discount_amount: z.coerce
    .number()
    .nonnegative()
    .default(0)
    .transform(sanitizePrice),
  tax_amount: z.coerce
    .number()
    .nonnegative()
    .default(0)
    .transform(sanitizePrice),
  payment_method: z.string().min(1).transform(sanitizeText),
  payment_status: z.string().default('unpaid').transform(sanitizeText),
  shipping_status: z.string().default('pending').transform(sanitizeText),
  shipping_address: z
    .object({
      address: z.string().min(1).transform(sanitizeText),
      city: z.string().transform(sanitizeText).optional(),
      state: z.string().transform(sanitizeText).optional(),
    })
    .optional(),
  source: z.string().default('online_store').transform(sanitizeText),
  notes: z.string().transform(sanitizeText).optional(),
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
  shipping_provider: z.string().transform(sanitizeText).optional(),
  tracking_number: z.string().transform(sanitizeText).optional(),
  // Legacy/Optional fields
  shipping_provider_legacy: z.string().transform(sanitizeText).optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
