import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

interface ClaimWalletCreditPushInput {
  reference: string;
  transactionId: string;
}

export type WalletCreditPushClaimResult =
  | { status: 'already_claimed' }
  | { status: 'claimed' }
  | { error: string; status: 'error' };

/** Atomically claims the one wallet-credit push associated with a transaction. */
export async function claimWalletCreditPush({
  reference,
  transactionId,
}: ClaimWalletCreditPushInput): Promise<WalletCreditPushClaimResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('claim_wallet_credit_push', {
      p_transaction_id: transactionId,
    });

    if (error) {
      logger.warn({
        error: error.message,
        message: 'Wallet-credit push claim failed',
        reference,
      });
      return { error: error.message, status: 'error' };
    }
    return data ? { status: 'claimed' } : { status: 'already_claimed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({
      error: message,
      message: 'Wallet-credit push claim failed',
      reference,
    });
    return { error: message, status: 'error' };
  }
}
