import { z } from 'zod';

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
      bank_code: z.string().regex(/^\d{3}$/, 'Bank code must be 3 digits'),
    })
  );

export type ResolvePaystackAccountInput = z.input<
  typeof resolvePaystackAccountSchema
>;

export type ResolvePaystackAccountOutput = z.infer<
  typeof resolvePaystackAccountSchema
>;
