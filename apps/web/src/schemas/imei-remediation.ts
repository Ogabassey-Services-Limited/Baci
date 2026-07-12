import { z } from 'zod';
import { RouteIdentifierSchema } from './route-identifier';

const identifierSchema = z.string().trim().min(8).max(15);

export const imeiRemediationEligibilitySchema = z.object({
  identifier: identifierSchema,
  lookupId: z.uuid(),
  merchantSlug: RouteIdentifierSchema.optional(),
});

export const imeiRemediationOrderSchema = z.object({
  identifier: identifierSchema,
  merchantSlug: RouteIdentifierSchema.optional(),
  orderId: z.uuid(),
  paymentCurrency: z.enum(['NGN', 'USDT']),
  productId: z.uuid(),
});
