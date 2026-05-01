import { z } from 'zod';
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from '@/lib/wallet-top-up-constants';

export const walletTopUpGatewayEnum = z.enum(['paystack', 'korapay']);

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

export const walletTopUpInitializeSchema = z.object({
  amount: walletTopUpAmountSchema,
  customerName: z.string().trim().min(1).optional(),
  customerPhone: z.string().trim().min(1).optional(),
  gateway: walletTopUpGatewayEnum.optional(),
  merchantSlug: z.string().trim().min(1, 'Merchant slug is required'),
});

export const walletTopUpConfirmSchema = z.object({
  gateway: walletTopUpGatewayEnum,
  merchantSlug: z.string().trim().min(1, 'Merchant slug is required'),
  reference: z.string().trim().min(1, 'Payment reference is required'),
});

export type WalletTopUpGateway = z.infer<typeof walletTopUpGatewayEnum>;
export type WalletTopUpInitializeInput = z.infer<
  typeof walletTopUpInitializeSchema
>;
export type WalletTopUpConfirmInput = z.infer<typeof walletTopUpConfirmSchema>;
