import { z } from 'zod';

const trimmedRequiredString = (message: string) =>
  z.string().trim().min(1, message);

const trimmedOptionalString = (message: string) =>
  trimmedRequiredString(message).optional();

export const PaymentGatewayParamsSchema = z
  .object({
    orderId: trimmedOptionalString('Order ID cannot be empty'),
    orderNumber: trimmedOptionalString('Order number cannot be empty'),
    gateway: z.enum(['paystack', 'korapay', 'juicyway'], {
      message: 'Invalid payment gateway',
    }),
    authorizationUrl: trimmedRequiredString(
      'Authorization URL is required'
    ).url('Invalid authorization URL'),
    reference: trimmedRequiredString('Reference is required'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than 0')
      .optional(),
    paymentKind: z.enum(['order', 'vtu']).default('order'),
    utilityType: z
      .enum(['airtime', 'data', 'tv', 'power', 'gaming'])
      .optional(),
    customerIdentifier: trimmedOptionalString(
      'Customer identifier cannot be empty'
    ),
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
