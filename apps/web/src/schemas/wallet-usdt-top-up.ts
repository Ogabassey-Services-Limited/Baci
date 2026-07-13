import { z } from 'zod';

const merchantIdSchema = z.string().trim().pipe(z.uuid()).optional();
const merchantSlugSchema = z.string().trim().min(1).optional();

export const walletUsdtTopUpInitializeSchema = z
  .object({
    amount: z.coerce.number().finite().min(1).max(10_000),
    billingAddress: z.object({
      city: z.string().trim().min(1).max(100),
      country: z
        .string()
        .trim()
        .length(2)
        .transform((value) => value.toUpperCase()),
      line1: z.string().trim().min(3).max(255),
      line2: z.string().trim().max(255).optional(),
      state: z.string().trim().max(100).optional(),
      zipCode: z.string().trim().min(1).max(20),
    }),
    chain: z.enum(['TRX', 'ETH', 'MATIC', 'AVAXC']),
    customerName: z.string().trim().min(1).max(100).optional(),
    customerPhone: z.string().trim().min(1).max(30).optional(),
    merchantId: merchantIdSchema,
    merchantSlug: merchantSlugSchema,
  })
  .superRefine((value, context) => {
    if (!value.merchantId && !value.merchantSlug) {
      context.addIssue({
        code: 'custom',
        message: 'Merchant slug or id is required',
        path: ['merchantSlug'],
      });
    }
  });

export type WalletUsdtTopUpInitializeInput = z.infer<
  typeof walletUsdtTopUpInitializeSchema
>;
