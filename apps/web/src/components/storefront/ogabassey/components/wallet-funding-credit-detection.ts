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
 * back to a purchase they still cannot afford. `source_type === 'wallet_topup'`
 * is the narrowest discriminator the wallet API exposes: it is written by
 * `credit_customer_wallet(p_source_type => 'wallet_topup')` for every wallet
 * FUNDING credit — the Paystack DVA bank transfer this loop watches for AND the
 * card top-up confirm route AND the savings auto-debit pre-credit all share it.
 *
 * ACCEPTED RESIDUAL (matches the mobile `wallet-top-up-credit` contract): a new
 * card top-up (or a savings auto-debit's transient pre-credit) can settle this
 * loop even though no BANK transfer landed. We do NOT scope to the DVA credit
 * for two reasons, both verified against the schema:
 *   1. There is no cheap/safe DVA discriminator on the exposed ledger. The
 *      `wallet_payment_account_id` marker lives on the separate `transactions`
 *      gateway row's `metadata` (written by `confirm-paystack-wallet-dva-top-up`),
 *      NOT on `customer_wallet_transactions`. `credit_customer_wallet` takes no
 *      metadata param and copies none into the ledger, so scoping to DVA would
 *      need a per-poll join on `source_id` (every 5s) or a schema/RPC change —
 *      out of scope for this dark-launched P3 leg.
 *   2. In the card-top-up case the wallet really WAS funded, so returning the
 *      customer to their purchase is still correct. The copy therefore never
 *      claims a bank transfer specifically arrived — see `wallet-funding-copy`
 *      `checkCredited`, which says only that the wallet was topped up.
 * The one genuinely-wrong window (savings auto-debit credits then immediately
 * debits to savings, leaving the balance flat) is background-scheduled and
 * vanishingly unlikely to overlap a live funding poll; the `returnReady` gate
 * in `WalletFundingCheckStatus` still blocks the return CTA until the refreshed
 * snapshot reflects the credit, so the worst case is a benign timeout re-check.
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
