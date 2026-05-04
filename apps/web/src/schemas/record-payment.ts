import { z } from 'zod';

export const recordPaymentBodySchema = z.object({
  amount: z.union([z.number(), z.string()]),
  payment_method: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export type RecordPaymentBodyInput = z.infer<typeof recordPaymentBodySchema>;
