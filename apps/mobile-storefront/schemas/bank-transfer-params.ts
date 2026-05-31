import { z } from 'zod';

const requiredTrimmedString = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

const BankTransferBaseParamsSchema = z.object({
  accountName: requiredTrimmedString('Account name is required'),
  accountNumber: requiredTrimmedString('Account number is required'),
  amount: requiredTrimmedString('Amount is required'),
  bankName: requiredTrimmedString('Bank name is required'),
  orderId: requiredTrimmedString('Order ID is required'),
  orderNumber: z.string().optional(),
  trackingToken: z.string().trim().optional(),
});

export const BankTransferParamsSchema = BankTransferBaseParamsSchema.extend({
  reference: requiredTrimmedString('Reference is required'),
});

export const WalletFundedBankTransferParamsSchema =
  BankTransferBaseParamsSchema.extend({
    intentId: requiredTrimmedString('Intent ID is required'),
    merchantId: z.string().trim().optional(),
    merchantSlug: z.string().trim().optional(),
    walletFunded: z.string().optional(),
  });

export type BankTransferParams = z.infer<typeof BankTransferParamsSchema>;
export type WalletFundedBankTransferParams = z.infer<
  typeof WalletFundedBankTransferParamsSchema
>;
