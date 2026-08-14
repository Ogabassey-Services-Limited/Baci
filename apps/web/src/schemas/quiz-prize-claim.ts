import { quizPrizeConditionSchema } from '@baci/shared/schemas';
import { z } from 'zod';

/** Bounded, server-authorized prize data used to create a checkout voucher. */
export const quizPrizeClaimProjectionSchema = z
  .strictObject({
    awardId: z.uuid(),
    condition: quizPrizeConditionSchema.nullable(),
    expiresAt: z.iso.datetime({ offset: true }),
    productId: z.uuid(),
    variantId: z.uuid().nullable(),
  })
  .nullable();

export type QuizPrizeClaimProjection = z.infer<
  typeof quizPrizeClaimProjectionSchema
>;
