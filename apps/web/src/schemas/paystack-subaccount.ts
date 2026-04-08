import { z } from 'zod';
import { paystackBankCodeSchema } from './paystack-bank-code';

const payoutModeSchema = z.enum(['manual', 'instant', 'weekly']);

export const paystackSubaccountSchema = z
  .object({
    account_number: z.string().optional(),
    accountNumber: z.string().optional(),
    bank_code: z.string().optional(),
    bankCode: z.string().optional(),
    business_name: z.string().optional(),
    businessName: z.string().optional(),
    payout_mode: payoutModeSchema.optional(),
    payoutMode: payoutModeSchema.optional(),
    auto_payout_enabled: z.boolean().optional(),
    autoPayoutEnabled: z.boolean().optional(),
  })
  .transform((data) => ({
    account_number: data.account_number ?? data.accountNumber ?? '',
    bank_code: data.bank_code ?? data.bankCode ?? '',
    business_name: data.business_name ?? data.businessName,
    payout_mode: data.payout_mode ?? data.payoutMode ?? 'manual',
    auto_payout_enabled:
      data.auto_payout_enabled ?? data.autoPayoutEnabled ?? false,
  }))
  .pipe(
    z.object({
      account_number: z
        .string()
        .regex(/^\d{10}$/, 'Account number must be 10 digits'),
      bank_code: paystackBankCodeSchema,
      business_name: z
        .string()
        .trim()
        .min(2, 'Business name is required')
        .optional(),
      payout_mode: payoutModeSchema,
      auto_payout_enabled: z.boolean(),
    })
  );

export type PaystackSubaccountInput = z.input<typeof paystackSubaccountSchema>;

export type PaystackSubaccountOutput = z.infer<typeof paystackSubaccountSchema>;
