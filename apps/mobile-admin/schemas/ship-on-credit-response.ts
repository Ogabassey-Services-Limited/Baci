import { z } from 'zod';

export const shipOnCreditResponseSchema = z.object({
  message: z.string().min(1),
  order: z.object({
    id: z.string().min(1),
    is_credit_order: z.boolean(),
    order_number: z.string().nullable(),
    shipping_status: z.enum([
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ]),
  }),
  success: z.literal(true),
  virtualAccount: z
    .object({
      account_name: z.string().min(1),
      account_number: z.string().min(1),
      bank_name: z.string().min(1),
    })
    .nullable(),
});
