import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.email('Invalid email address'),
  merchantId: z.uuid('Invalid merchant ID').optional(),
  source: z
    .enum(['widget', 'footer', 'checkout', 'popup'])
    .optional()
    .default('widget'),
});

export const unsubscribeSchema = z.object({
  email: z.email('Invalid email address'),
  merchantId: z.uuid('Invalid merchant ID').optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
