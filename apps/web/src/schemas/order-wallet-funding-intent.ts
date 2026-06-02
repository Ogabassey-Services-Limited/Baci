import { z } from 'zod';
import {
  optionalMerchantId,
  optionalNonEmptyString,
  requireMerchantIdentifier,
} from '@/schemas/merchant-identifier';

const merchantIdentifierObjectSchema = z.object({
  merchantId: optionalMerchantId,
  merchantSlug: optionalNonEmptyString,
});

export const orderWalletFundingIntentCreateSchema = z
  .strictObject(
    merchantIdentifierObjectSchema.extend({
      // Consent is only required when this request needs to provision a wallet DVA.
      // Existing wallet accounts may create an order-funding intent without resending it.
      consent: z.literal(true).optional(),
      orderId: z.uuid('Order id must be a valid UUID'),
    }).shape
  )
  .superRefine(requireMerchantIdentifier);

export const orderWalletFundingIntentPollSchema = z
  .strictObject(merchantIdentifierObjectSchema.shape)
  .superRefine(requireMerchantIdentifier);

export const ambiguousReviewSchema = z.object({
  gatewayReference: z.string().trim().min(1),
  intentIds: z.array(z.string().trim().min(1)).min(1),
});

export type OrderWalletFundingIntentCreateInput = z.infer<
  typeof orderWalletFundingIntentCreateSchema
>;

export type OrderWalletFundingIntentPollInput = z.infer<
  typeof orderWalletFundingIntentPollSchema
>;
