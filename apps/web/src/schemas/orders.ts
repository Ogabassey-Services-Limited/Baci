import { z } from 'zod';

export const orderCreateSchema = z.object({
  merchant_id: z.string().uuid(),
  customer_email: z.string().email(),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  items: z
    .array(
      z
        .object({
          product_id: z.string().optional(),
          productId: z.string().optional(),
          id: z.string().optional(),
          name: z.string().min(1),
          productName: z.string().optional(),
          quantity: z.number().int().positive(),
          price: z.number().nonnegative(),
          negotiatedPrice: z.number().nonnegative().optional(),
          value: z.number().nonnegative().optional(),
          has_assurance: z.boolean().optional(),
          assurance_fee: z.number().nonnegative().optional(),
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
  subtotal: z.coerce.number().nonnegative(),
  shipping_fee: z.coerce.number().nonnegative().default(0),
  discount_amount: z.coerce.number().nonnegative().default(0),
  tax_amount: z.coerce.number().nonnegative().default(0),
  payment_method: z.string().min(1),
  payment_status: z.string().default('unpaid'),
  shipping_status: z.string().default('pending'),
  shipping_address: z
    .object({
      address: z.string().min(1),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  source: z.string().default('online_store'),
  notes: z.string().optional(),
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
  shipping_provider_legacy: z.string().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
