import type { WalletCreditPollTransaction } from '@/schemas/wallet-credit-poll';
import { WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/wallet-top-up-source-type';

export interface WalletTopUpCredit {
  amount: number;
  id: string;
}

/**
 * Finds a wallet TOP-UP credit that is not in the pre-arm baseline.
 *
 * Why not a balance delta: cashback, refunds and order reversals are all
 * `type: 'credit'` and all raise the balance, so a delta would announce
 * "transfer received" to a customer whose transfer never landed — sending them
 * back to a purchase they still cannot afford. Only
 * `source_type === 'wallet_topup'` is written by the DVA credit path
 * (`credit_customer_wallet(p_source_type => …)`), so it is the sole sound
 * discriminator.
 *
 * Fails CLOSED: a missing/null `source_type`, a non-credit row, a non-positive
 * amount or an id already known before arming all yield `null` (keep polling).
 */
export function detectWalletTopUpCredit(
  transactions: readonly WalletCreditPollTransaction[],
  knownTransactionIds: ReadonlySet<string>
): WalletTopUpCredit | null {
  for (const transaction of transactions) {
    if (transaction.source_type !== WALLET_TOP_UP_TRANSACTION_TYPE) continue;
    if (transaction.type !== 'credit') continue;
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
      continue;
    }
    if (knownTransactionIds.has(transaction.id)) continue;
    return { amount: transaction.amount, id: transaction.id };
  }
  return null;
}
