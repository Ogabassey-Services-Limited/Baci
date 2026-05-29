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
  ).filter(
    (candidate) =>
      paidAtFitsIntent(candidate, args.paidAt) &&
      amountFitsIntent(candidate, args.amount)
  );

  if (compatible.length === 0) return { kind: 'none' };
  if (compatible.length === 1) {
    return { intent: compatible[0], kind: 'match' };
  }
  return {
    intentIds: compatible.map((candidate) => candidate.id),
    kind: 'ambiguous',
  };
}
