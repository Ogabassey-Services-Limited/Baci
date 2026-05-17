import { z } from 'zod';
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from '@/lib/wallet-top-up-constants';

export const walletTopUpGatewayEnum = z.enum(['paystack', 'korapay']);

const walletTopUpMerchantSlugSchema = z
  .string()
  .trim()
  .min(1, 'Merchant slug cannot be empty')
  .optional();

const walletTopUpMerchantIdSchema = z
  .string()
  .trim()
  .min(1, 'Merchant id cannot be empty')
  .uuid('Merchant id must be a valid UUID')
  .optional();

const walletTopUpAmountSchema = z.coerce
  .number({ message: 'Amount must be a valid number' })
  .finite('Amount cannot be Infinity or NaN')
  .min(
    WALLET_TOP_UP_MIN_AMOUNT,
    `Wallet top-up amount must be at least ₦${WALLET_TOP_UP_MIN_AMOUNT}`
  )
  .max(
    WALLET_TOP_UP_MAX_AMOUNT,
    `Wallet top-up amount cannot exceed ₦${WALLET_TOP_UP_MAX_AMOUNT.toLocaleString()}`
  );

function requireMerchantIdentifier(
  data: { merchantId?: string; merchantSlug?: string },
  ctx: z.RefinementCtx
) {
  if (!data.merchantId && !data.merchantSlug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Merchant slug or id is required',
      path: ['merchantSlug'],
    });
  }
}

export const walletTopUpInitializeSchema = z
  .object({
    amount: walletTopUpAmountSchema,
    customerName: z.string().trim().min(1).optional(),
    customerPhone: z.string().trim().min(1).optional(),
    gateway: walletTopUpGatewayEnum.optional(),
    merchantId: walletTopUpMerchantIdSchema,
    merchantSlug: walletTopUpMerchantSlugSchema,
  })
  .superRefine(requireMerchantIdentifier);

export const walletTopUpConfirmSchema = z
  .object({
    gateway: walletTopUpGatewayEnum,
    merchantId: walletTopUpMerchantIdSchema,
    merchantSlug: walletTopUpMerchantSlugSchema,
    reference: z.string().trim().min(1, 'Payment reference is required'),
  })
  .superRefine(requireMerchantIdentifier);

export type WalletTopUpGateway = z.infer<typeof walletTopUpGatewayEnum>;
export type WalletTopUpInitializeInput = z.infer<
  typeof walletTopUpInitializeSchema
>;
export type WalletTopUpConfirmInput = z.infer<typeof walletTopUpConfirmSchema>;
