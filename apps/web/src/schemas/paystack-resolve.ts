import { z } from 'zod';
import { paystackBankCodeSchema } from './paystack-bank-code';

export const resolvePaystackAccountSchema = z
  .object({
    account_number: z.string().optional(),
    accountNumber: z.string().optional(),
    bank_code: z.string().optional(),
    bankCode: z.string().optional(),
  })
  .transform((data) => ({
    account_number: data.account_number ?? data.accountNumber ?? '',
    bank_code: data.bank_code ?? data.bankCode ?? '',
  }))
  .pipe(
    z.object({
      account_number: z
        .string()
        .regex(/^\d{10}$/, 'Account number must be 10 digits'),
      bank_code: paystackBankCodeSchema,
    })
  );

export type ResolvePaystackAccountInput = z.input<
  typeof resolvePaystackAccountSchema
>;

export type ResolvePaystackAccountOutput = z.infer<
  typeof resolvePaystackAccountSchema
>;
