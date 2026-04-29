import { z } from 'zod';

export const PaymentGatewayParamsSchema = z
  .object({
    orderId: z.string().optional(),
    orderNumber: z.string().optional(),
    gateway: z.enum(['paystack', 'korapay', 'juicyway'], {
      message: 'Invalid payment gateway',
    }),
    authorizationUrl: z.string().url('Invalid authorization URL'),
    reference: z.string().min(1, 'Reference is required'),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    paymentKind: z.enum(['order', 'vtu']).default('order'),
    utilityType: z
      .enum(['airtime', 'data', 'tv', 'power', 'gaming'])
      .optional(),
    customerIdentifier: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentKind === 'vtu') {
      if (!data.utilityType) {
        ctx.addIssue({
          code: 'custom',
          message: 'Utility type is required for VTU payments',
          path: ['utilityType'],
        });
      }

      if (!data.customerIdentifier) {
        ctx.addIssue({
          code: 'custom',
          message: 'Customer identifier is required for VTU payments',
          path: ['customerIdentifier'],
        });
      }
      return;
    }

    if (!data.orderId && !data.orderNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'Order ID or order number is required for order payments',
        path: ['orderId'],
      });
    }
  });

export type PaymentGatewayParams = z.infer<typeof PaymentGatewayParamsSchema>;
