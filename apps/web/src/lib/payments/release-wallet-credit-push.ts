import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

interface ReleaseWalletCreditPushInput {
  claimToken: string;
  reference: string;
  transactionId: string;
}

export type WalletCreditPushReleaseResult =
  | { status: 'not_claimed' }
  | { status: 'released' }
  | { error: string; status: 'error' };

/** Releases a failed delivery claim so a later idempotent replay can retry. */
export async function releaseWalletCreditPush({
  claimToken,
  reference,
  transactionId,
}: ReleaseWalletCreditPushInput): Promise<WalletCreditPushReleaseResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('release_wallet_credit_push', {
      p_claim_token: claimToken,
      p_transaction_id: transactionId,
    });
    if (error) {
      logger.warn({
        error: error.message,
        message: 'Wallet-credit push release failed',
        reference,
      });
      return { error: error.message, status: 'error' };
    }
    return data ? { status: 'released' } : { status: 'not_claimed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({
      error: message,
      message: 'Wallet-credit push release failed',
      reference,
    });
    return { error: message, status: 'error' };
  }
}
