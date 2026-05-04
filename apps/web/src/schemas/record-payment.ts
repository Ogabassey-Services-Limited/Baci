import { z } from 'zod';

export const recordPaymentBodySchema = z.object({
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z
      .number()
      .finite('Amount must be a finite number')
      .gt(0, 'Amount must be greater than 0')
      .refine(
        (v) => Number.parseFloat(v.toFixed(2)) === v,
        'Amount must have at most 2 decimal places'
      )
  ),
  payment_method: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export type RecordPaymentBodyInput = z.infer<typeof recordPaymentBodySchema>;
