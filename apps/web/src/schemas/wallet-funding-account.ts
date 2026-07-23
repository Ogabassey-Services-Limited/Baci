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

/**
 * RESPONSE shape of the customer wallet DVA as returned by the funding-account
 * and order-funding-intent APIs. `accountName`/`bankName` are nullable because
 * `StorefrontWalletFundingAccount` (@baci/shared) models them that way — the
 * gateway can omit them — so consumers must render a fallback rather than
 * assume a string.
 */
export const walletFundingAccountSchema = z.object({
  accountName: z.string().trim().min(1).max(120).nullable(),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10,20}$/),
  bankName: z.string().trim().min(1).max(120).nullable(),
  provider: z.enum(['paystack']),
});

export type WalletFundingAccountResponse = z.infer<
  typeof walletFundingAccountSchema
>;
