import { z } from 'zod';

const identifierSchema = z.string().trim().min(8).max(15);

export const imeiRemediationEligibilitySchema = z.object({
  identifier: identifierSchema,
  lookupId: z.uuid(),
});

export const imeiRemediationOrderSchema = z.object({
  identifier: identifierSchema,
  orderId: z.uuid(),
  paymentCurrency: z.enum(['NGN', 'USDT']),
  productId: z.uuid(),
});
