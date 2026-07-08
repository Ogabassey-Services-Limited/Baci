import { z } from 'zod';

/**
 * Request schemas for the three PayPal BYOK checkout routes (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2). Extracted from the
 * prototype's inline route schemas per the repo's "no inline Zod in routes"
 * rule. All three routes are public storefront endpoints — the money binding
 * is enforced server-side via order_id + customer_email + merchant_id, never
 * by an authenticated merchant session.
 */

export const paypalCreateOrderSchema = z.object({
  order_id: z.uuid(),
  customer_email: z.email(),
  merchant_id: z.uuid(),
  return_url: z.url().optional(),
  cancel_url: z.url().optional(),
});

export const paypalCaptureOrderSchema = z.object({
  order_id: z.uuid(),
  paypal_order_id: z.string().trim().min(1),
  customer_email: z.email(),
  merchant_id: z.uuid(),
});

export const paypalClientTokenSchema = z.object({
  merchant_id: z.uuid(),
});

export type PaypalCreateOrderInput = z.infer<typeof paypalCreateOrderSchema>;
export type PaypalCaptureOrderInput = z.infer<typeof paypalCaptureOrderSchema>;
export type PaypalClientTokenInput = z.infer<typeof paypalClientTokenSchema>;
