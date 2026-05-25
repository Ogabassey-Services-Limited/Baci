import { z } from 'zod';
import {
  optionalMerchantId,
  optionalNonEmptyString,
  requireWalletFundingMerchantIdentifier,
} from '@/schemas/merchant-identifier';

const walletFundingMerchantIdentifierObjectSchema = z.object({
  merchantId: optionalMerchantId,
  merchantSlug: optionalNonEmptyString,
});

const walletFundingMerchantIdentifierSchema =
  walletFundingMerchantIdentifierObjectSchema.superRefine(
    requireWalletFundingMerchantIdentifier
  );

export const walletFundingAccountQuerySchema =
  walletFundingMerchantIdentifierSchema;

export const walletFundingAccountConsentSchema =
  walletFundingMerchantIdentifierObjectSchema
    .extend({
      consent: z.literal(true),
    })
    .superRefine(requireWalletFundingMerchantIdentifier);
