import { z } from 'zod';

const receiverOverride = z
  .object({
    address: z.string().trim().min(1),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    phone: z.string().trim().min(1),
  })
  .strict();

export const orderGiglQuoteSchema = z.object({
  receiver: receiverOverride.optional(),
});

export const adminOrderGiglQuoteSchema = orderGiglQuoteSchema.extend({
  admin_order_id: z.string().uuid(),
});

export type OrderGiglQuoteInput = z.infer<typeof orderGiglQuoteSchema>;
