import { z } from 'zod/v3';

// Same rule and message as ProfileSchema's phone field (schemas/profile-edit),
// minus its optional wrapper — the wallet funding prompt requires a number.
export const WalletFundPhoneSchema = z.object({
  phone: z.string().trim().min(10, 'Valid phone number required'),
});

export type WalletFundPhoneFormData = z.infer<typeof WalletFundPhoneSchema>;
