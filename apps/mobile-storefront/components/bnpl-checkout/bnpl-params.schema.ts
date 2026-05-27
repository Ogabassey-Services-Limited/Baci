import { z } from 'zod';

export const BNPLParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  gateway: z.enum(['credpal', 'credit_direct', 'klump'] as const, {
    message: 'Invalid payment gateway',
  }),
  authorizationUrl: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+$/, 'Amount must be a number').optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  merchantSlug: z.string().optional(),
  reference: z.string().optional(),
  trackingToken: z.string().optional(),
});
