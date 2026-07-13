import { z } from 'zod';

// Result payload of the `complete_order_gateway_payment` RPC
// (supabase/migrations/20260713130000_complete_order_gateway_payment_atomic.sql).
// Parsed at the RPC boundary so route/cron callers never touch raw jsonb.
export const orderGatewayPaymentCompletionSchema = z.object({
  error_code: z
    .enum([
      'INVALID_ARGUMENTS',
      'TRANSACTION_NOT_FOUND',
      'ORDER_TRANSACTION_MISMATCH',
      'TRANSACTION_IN_UNEXPECTED_STATE',
      'ORDER_NOT_FOUND',
    ])
    .optional(),
  transaction_status: z.string().nullish(),
  already_completed: z.boolean().optional(),
  order_already_paid: z.boolean().optional(),
  order_updated: z.boolean().optional(),
  order_cancelled: z.boolean().optional(),
  order_skipped_status: z.string().nullish(),
  previous_payment_status: z.string().nullish(),
  previous_shipping_status: z.string().nullish(),
  payment_status: z.string().nullish(),
  shipping_status: z.string().nullish(),
  cancelled_at: z.string().nullish(),
  order_number: z.string().nullish(),
  actor: z.string().nullish(),
});

export type OrderGatewayPaymentCompletion = z.infer<
  typeof orderGatewayPaymentCompletionSchema
>;
