import { z } from 'zod';

const creditDirectAmountSchema = z
  .union([
    z.number().finite(),
    z.string().regex(/^[0-9]+(?:\.[0-9]{1,2})?$/, 'Invalid amount format'),
  ])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .pipe(z.number().positive());

export const creditDirectSignSchema = z.object({
  customerEmail: z.string().max(254).email(),
  totalAmount: creditDirectAmountSchema,
  merchantSlug: z.string().min(1),
  orderId: z.string().uuid(),
});

export type CreditDirectSignInput = z.infer<typeof creditDirectSignSchema>;
