import { z } from 'zod';

const walletTransactionTypeSchema = z.enum([
  'credit',
  'debit',
  'withdrawal',
  'payout',
  'refund',
  'adjustment',
]);

const positiveIntegerQueryParam = (defaultValue: number) =>
  z.coerce.number().int().min(1).prefault(defaultValue);

export const walletTransactionsQuerySchema = z.object({
  page: positiveIntegerQueryParam(1),
  limit: positiveIntegerQueryParam(20).transform((value) =>
    Math.min(value, 100)
  ),
  type: walletTransactionTypeSchema.optional(),
});
