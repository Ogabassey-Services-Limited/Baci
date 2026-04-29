import { z } from 'zod';

export const PaymentGatewayParamsSchema = z.object({
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  gateway: z.enum(['paystack', 'korapay', 'juicyway'] as const, {
    message: 'Invalid payment gateway',
  }),
  authorizationUrl: z.string().url('Invalid authorization URL'),
  reference: z.string().min(1, 'Reference is required'),
  amount: z.string().optional(),
  paymentKind: z.enum(['order', 'vtu']).default('order'),
  utilityType: z.enum(['airtime', 'data', 'tv', 'power', 'gaming']).optional(),
  customerIdentifier: z.string().optional(),
});
