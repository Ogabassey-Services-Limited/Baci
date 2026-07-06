import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrderWalletFundingIntentRepository,
  WalletFundingIntentTransferMatch,
} from '@/lib/order-wallet-funding-intent-types';
import { getRepository } from '@/lib/order-wallet-funding-repository-access';
import {
  amountFitsIntent,
  paidAtFitsIntent,
} from '@/lib/order-wallet-funding-utils';

/**
 * Returns active order-funding matches for a wallet DVA transfer.
 *
 * With a SINGLE active intent, any positive transfer inside the window
 * matches — including partials below the remaining amount.
 * finalize_wallet_funded_order accumulates funded_amount, marks the intent
 * 'underfunded' while short, and only debits once the wallet's ACTUAL
 * balance covers target_order_amount, so several small transfers (or a
 * top-up landing next to an existing balance) complete the order without
 * any single transfer having to cover the whole remainder.
 *
 * With MULTIPLE concurrent intents, transfer size is the only signal we
 * have, so the strict full-cover rule disambiguates: a transfer covering
 * exactly one intent's remainder pays that order, a transfer covering
 * several goes to review, and a partial covering none credits the wallet
 * as a plain top-up (no attribution, no review noise, no intent freeze).
 *
 * Repository failures intentionally propagate to the caller so money-webhook
 * processing can fail closed and retry instead of silently treating a database
 * outage as "no matching order".
 */
export async function findActiveWalletFundingIntentForTransfer(args: {
  amount: number;
  paidAt: Date;
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
  walletPaymentAccountId: string;
}): Promise<WalletFundingIntentTransferMatch> {
  if (
    !args.walletPaymentAccountId ||
    !Number.isFinite(args.amount) ||
    args.amount <= 0 ||
    !(args.paidAt instanceof Date) ||
    !Number.isFinite(args.paidAt.getTime())
  ) {
    return { kind: 'none' };
  }

  const repository = getRepository(args);
  await repository.expireStaleWalletFundingIntents({
    now: args.paidAt,
    walletPaymentAccountId: args.walletPaymentAccountId,
  });
  const compatible = (
    await repository.findActiveWalletAccountIntents({
      walletPaymentAccountId: args.walletPaymentAccountId,
    })
  ).filter((candidate) => paidAtFitsIntent(candidate, args.paidAt));

  if (compatible.length === 0) return { kind: 'none' };
  if (compatible.length === 1) {
    return { intent: compatible[0], kind: 'match' };
  }

  const covered = compatible.filter((candidate) =>
    amountFitsIntent(candidate, args.amount)
  );
  if (covered.length === 0) return { kind: 'none' };
  if (covered.length === 1) {
    return { intent: covered[0], kind: 'match' };
  }
  return {
    intentIds: covered.map((candidate) => candidate.id),
    kind: 'ambiguous',
  };
}
