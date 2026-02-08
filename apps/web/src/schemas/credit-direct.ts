import { z } from 'zod';

export const creditDirectSignSchema = z.object({
  customerEmail: z.string().max(254).email(),
  totalAmount: z.number().positive(),
  merchantSlug: z.string().min(1),
  orderId: z.string().uuid(),
});

export type CreditDirectSignInput = z.infer<typeof creditDirectSignSchema>;
