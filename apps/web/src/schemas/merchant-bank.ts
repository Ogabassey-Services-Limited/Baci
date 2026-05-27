import { z } from 'zod';

export const merchantBankSchema = z.object({
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
  bankCode: z.string().min(1, 'Please select your bank'),
  businessName: z.string().trim().min(2, 'Business name is required'),
  autoPayoutEnabled: z.boolean().optional(),
});

export const internationalMerchantBankSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 -]{5,33}$/,
      'Account number must be 6 to 34 characters and may include letters, digits, spaces, and hyphens'
    ),
  bankName: z.string().trim().min(2, 'Bank name is required'),
  businessName: z.string().trim().min(2, 'Business name is required'),
});

export interface MerchantBankFormInput {
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  businessName: string;
  autoPayoutEnabled?: boolean;
}

export type MerchantBankFormValues = MerchantBankFormInput;
