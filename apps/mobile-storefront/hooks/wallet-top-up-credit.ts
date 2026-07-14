/**
 * Ledger provenance written by `credit_customer_wallet(p_source_type => …)`
 * for every wallet funding credit — card, USDT, and (the flow this powers)
 * Paystack dedicated-virtual-account bank transfers. Cashback lands as
 * `vtu_transaction`, reversals as `order_reversal`, so this value — not the
 * `credit` row type and not a balance delta — is what identifies a top-up.
 */
export const WALLET_TOP_UP_SOURCE_TYPE = 'wallet_topup';

/** Structural subset of a wallet transaction the credit watch needs. */
export interface WalletTopUpCandidate {
  amount: number;
  created_at: string;
  id: string;
  source_type?: string | null;
  type: string;
}

export interface WalletTopUpCredit {
  amount: number;
  createdAt: number | null;
  id: string;
}

function isTopUpCredit(transaction: WalletTopUpCandidate): boolean {
  return (
    transaction.type === 'credit' &&
    transaction.source_type === WALLET_TOP_UP_SOURCE_TYPE &&
    Number.isFinite(transaction.amount)
  );
}

function toCreatedAt(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Newest wallet top-up credit in the transaction list, or `null` when the list
 * is unavailable (still loading) or holds no top-up. The list is not trusted to
 * be sorted; ties keep the first match, which is the server's `created_at desc`
 * order.
 */
export function findLatestWalletTopUpCredit(
  transactions: readonly WalletTopUpCandidate[] | undefined
): WalletTopUpCredit | null {
  if (!transactions) {
    return null;
  }

  let latest: WalletTopUpCredit | null = null;
  for (const transaction of transactions) {
    if (!isTopUpCredit(transaction)) {
      continue;
    }
    const candidate: WalletTopUpCredit = {
      amount: transaction.amount,
      createdAt: toCreatedAt(transaction.created_at),
      id: transaction.id,
    };
    if (
      latest === null ||
      (candidate.createdAt !== null &&
        latest.createdAt !== null &&
        candidate.createdAt > latest.createdAt)
    ) {
      latest = candidate;
    }
  }

  return latest;
}

/**
 * True when `latest` is a top-up the customer has not already been shown —
 * i.e. a different ledger row than the pre-transfer baseline, not older than
 * it. A `null` baseline means "no top-up existed when the panel opened", so any
 * top-up is new.
 */
export function isNewWalletTopUpCredit(
  latest: WalletTopUpCredit,
  baseline: WalletTopUpCredit | null
): boolean {
  if (baseline === null) {
    return true;
  }
  if (latest.id === baseline.id) {
    return false;
  }
  if (latest.createdAt === null || baseline.createdAt === null) {
    return true;
  }
  return latest.createdAt >= baseline.createdAt;
}
