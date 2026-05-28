import { z } from 'zod';

export const merchantBankSchema = z.object({
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
  bankCode: z.string().min(1, 'Please select your bank'),
  businessName: z.string().trim().min(2, 'Business name is required'),
  autoPayoutEnabled: z.boolean().optional(),
});

export interface MerchantBankFormInput {
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  businessName: string;
  autoPayoutEnabled?: boolean;
}

export type MerchantBankFormValues = MerchantBankFormInput;
