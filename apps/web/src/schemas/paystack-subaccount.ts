import { z } from 'zod';
import { isValidManualAccountNumber } from '@/schemas/manual-account-number';

const payoutModeSchema = z.enum(['manual', 'instant', 'weekly']);

const paystackSubaccountSourceSchema = z.object({
  merchantId: z.string().trim().uuid().optional(),
  account_number: z.string().optional(),
  accountNumber: z.string().optional(),
  bank_code: z.string().optional(),
  bankCode: z.string().optional(),
  bank_name: z.string().optional(),
  bankName: z.string().optional(),
  account_name: z.string().optional(),
  accountName: z.string().optional(),
  business_name: z.string().optional(),
  businessName: z.string().optional(),
  payout_mode: payoutModeSchema.optional(),
  payoutMode: payoutModeSchema.optional(),
  auto_payout_enabled: z.boolean().optional(),
  autoPayoutEnabled: z.boolean().optional(),
});

export const paystackSubaccountSchema = paystackSubaccountSourceSchema
  .transform((data) => {
    const bankName = (data.bank_name ?? data.bankName ?? '').trim();
    const accountName = (data.account_name ?? data.accountName ?? '').trim();

    return {
      merchant_id: data.merchantId,
      account_number: (data.account_number ?? data.accountNumber ?? '').trim(),
      bank_code: (data.bank_code ?? data.bankCode ?? '').trim(),
      ...(bankName ? { bank_name: bankName } : {}),
      ...(accountName ? { account_name: accountName } : {}),
      business_name: (data.business_name ?? data.businessName)?.trim(),
      payout_mode: data.payout_mode ?? data.payoutMode ?? 'manual',
      auto_payout_enabled:
        data.auto_payout_enabled ?? data.autoPayoutEnabled ?? false,
    };
  })
  .superRefine((data, ctx) => {
    const isOfflineBank = Boolean(data.bank_name);

    if (isOfflineBank) {
      if (!isValidManualAccountNumber(data.account_number)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Account number must be 6 to 34 characters and may include letters, digits, spaces, and hyphens',
          path: ['account_number'],
        });
      }
    } else {
      if (!/^\d{10}$/.test(data.account_number)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Account number must be exactly 10 digits',
          path: ['account_number'],
        });
      }

      if (!data.bank_code) {
        ctx.addIssue({
          code: 'custom',
          message: 'Bank code is required',
          path: ['bank_code'],
        });
      }
    }

    if (data.account_name && data.account_name.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Account name must be at least 2 characters',
        path: ['account_name'],
      });
    }

    if (
      data.business_name !== undefined &&
      data.business_name.trim().length < 2
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Business name must be at least 2 characters',
        path: ['business_name'],
      });
    }
  });

export type PaystackSubaccountInput = z.input<typeof paystackSubaccountSchema>;

export type PaystackSubaccountOutput = z.infer<typeof paystackSubaccountSchema>;
