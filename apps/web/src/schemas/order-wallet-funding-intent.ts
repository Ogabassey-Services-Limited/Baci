import { z } from 'zod';
import {
  optionalMerchantId,
  optionalNonEmptyString,
  requireMerchantIdentifier,
} from '@/schemas/merchant-identifier';
import { walletFundingAccountSchema } from '@/schemas/wallet-funding-account';

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

/**
 * RESPONSE schemas — the web checkout parses the intent API's replies through
 * these before trusting them. Mirrors
 * `apps/mobile-storefront/schemas/order-wallet-funding-intent.ts` so both
 * platforms speak one protocol; the status union is the DB enum
 * (`OrderWalletFundingIntentStatus`).
 */
export const walletOrderFundingIntentStatusSchema = z.enum([
  'pending',
  'underfunded',
  'funded',
  'processing',
  'completed',
  'expired',
  'cancelled',
  'review_required',
  'failed',
]);

const currencySchema = z
  .string()
  .trim()
  .transform((currency) => currency.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3}$/));

export const walletOrderFundingIntentSchema = z.object({
  currency: currencySchema,
  debitedAmount: z.number().min(0).optional(),
  excessAmount: z.number().min(0).optional(),
  expectedAmount: z.number().gt(0),
  expiresAt: z.iso.datetime(),
  fundedAmount: z.number().min(0),
  id: z.uuid(),
  orderId: z.uuid(),
  // Only the poll route returns these; the create route omits them.
  orderPaid: z.boolean().optional(),
  remainingAmount: z.number().min(0).optional(),
  status: walletOrderFundingIntentStatusSchema,
  targetOrderAmount: z.number().gt(0),
});

export const walletOrderFundingIntentCreateResponseSchema = z.object({
  account: walletFundingAccountSchema,
  intent: walletOrderFundingIntentSchema,
});

export const walletOrderFundingIntentPollResponseSchema = z.object({
  intent: walletOrderFundingIntentSchema,
});

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

export type WalletOrderFundingIntent = z.infer<
  typeof walletOrderFundingIntentSchema
>;

export type WalletOrderFundingIntentStatus = z.infer<
  typeof walletOrderFundingIntentStatusSchema
>;

export type WalletOrderFundingIntentCreateResponse = z.infer<
  typeof walletOrderFundingIntentCreateResponseSchema
>;
