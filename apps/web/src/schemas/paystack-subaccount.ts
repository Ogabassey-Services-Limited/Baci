import { z } from 'zod';
import { paystackBankCodeSchema } from './paystack-bank-code';

const payoutModeSchema = z.enum(['manual', 'instant', 'weekly']);

const paystackSubaccountSourceSchema = z.object({
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
});

export const paystackSubaccountSchema = paystackSubaccountSourceSchema
  .transform((data) => ({
    account_number: data.account_number ?? data.accountNumber ?? '',
    bank_code: data.bank_code ?? data.bankCode ?? '',
    business_name: data.business_name ?? data.businessName,
    payout_mode: data.payout_mode ?? data.payoutMode ?? 'manual',
    auto_payout_enabled:
      data.auto_payout_enabled ?? data.autoPayoutEnabled ?? false,
  }))
  .superRefine((data, ctx) => {
    if (!/^\d{10}$/.test(data.account_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account number must be 10 digits',
        path: ['account_number'],
      });
    }

    const bankCodeResult = paystackBankCodeSchema.safeParse(data.bank_code);
    if (!bankCodeResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: bankCodeResult.error.issues[0]?.message || 'Invalid bank code',
        path: ['bank_code'],
      });
    }

    if (
      data.business_name !== undefined &&
      data.business_name.trim().length < 2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Business name must be at least 2 characters',
        path: ['business_name'],
      });
    }
  });

export type PaystackSubaccountInput = z.input<typeof paystackSubaccountSchema>;

export type PaystackSubaccountOutput = z.infer<typeof paystackSubaccountSchema>;
