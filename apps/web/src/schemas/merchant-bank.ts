import { z } from 'zod';
import { isValidManualAccountNumber } from '@/schemas/manual-account-number';

export const merchantBankSchema = z
  .object({
    accountNumber: z.string().trim(),
    bankCode: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    accountName: z.string().trim().optional(),
    businessName: z.string().trim().min(2, 'Business name is required'),
    autoPayoutEnabled: z.boolean().optional(),
    manualBankDetails: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const isManualBankDetails = data.manualBankDetails === true;

    if (isManualBankDetails) {
      if (!data.bankName) {
        ctx.addIssue({
          code: 'custom',
          message: 'Bank name is required',
          path: ['bankName'],
        });
      }

      if (!isValidManualAccountNumber(data.accountNumber)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Account number must be 6 to 34 characters and may include letters, digits, spaces, and hyphens',
          path: ['accountNumber'],
        });
      }

      if (data.accountName && data.accountName.length < 2) {
        ctx.addIssue({
          code: 'custom',
          message: 'Account name must be at least 2 characters',
          path: ['accountName'],
        });
      }

      return;
    }

    if (!/^\d{10}$/.test(data.accountNumber)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Account number must be exactly 10 digits',
        path: ['accountNumber'],
      });
    }

    if (!data.bankCode) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select your bank',
        path: ['bankCode'],
      });
    }
  });

export type MerchantBankFormInput = z.infer<typeof merchantBankSchema>;

export type MerchantBankFormValues = MerchantBankFormInput;
