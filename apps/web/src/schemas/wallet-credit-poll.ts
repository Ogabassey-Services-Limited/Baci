import { z } from 'zod';

/**
 * The subset of `GET /api/storefront/customer/wallet` the funding check loop
 * reads. Deliberately strict on the fields detection depends on: an unparseable
 * payload must fail CLOSED (keep polling / time out), never announce a credit.
 */
const walletCreditPollTransactionSchema = z.object({
  amount: z.coerce.number(),
  created_at: z.string().optional(),
  id: z.string().min(1),
  // Absent on responses from a deploy that predates the column being exposed —
  // treated as "not a top-up" by detection, which is the fail-closed direction.
  source_type: z.string().nullish(),
  type: z.string(),
});

export const walletCreditPollResponseSchema = z.object({
  balance: z.coerce.number().optional(),
  transactions: z.array(walletCreditPollTransactionSchema),
});

export type WalletCreditPollTransaction = z.infer<
  typeof walletCreditPollTransactionSchema
>;

export type WalletCreditPollResponse = z.infer<
  typeof walletCreditPollResponseSchema
>;
