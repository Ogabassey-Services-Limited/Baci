import { claimWalletCreditPush } from '@/lib/payments/claim-wallet-credit-push';
import type { NotifyWalletCreditedResult } from '@/lib/payments/notify-wallet-credited';
import { releaseWalletCreditPush } from '@/lib/payments/release-wallet-credit-push';

interface RunClaimedWalletCreditPushArgs {
  claimToken: string;
  notify: () => Promise<NotifyWalletCreditedResult>;
  onFailure: (error: unknown) => void;
  reference: string;
  transactionId: string;
}

/** Runs one wallet-credit push behind an atomic, retry-aware delivery claim. */
export async function runClaimedWalletCreditPush({
  claimToken,
  notify,
  onFailure,
  reference,
  transactionId,
}: RunClaimedWalletCreditPushArgs): Promise<void> {
  let ownsClaim = false;
  const claimArgs = { claimToken, reference, transactionId };
  const releaseClaim = async (): Promise<void> => {
    try {
      let release = await releaseWalletCreditPush(claimArgs);
      if (release.status === 'error') {
        release = await releaseWalletCreditPush(claimArgs);
      }
      if (release.status === 'error') {
        // No independent durable store exists for this pre-send failure. If
        // the database remains unavailable, retain the claim and fail closed:
        // stale takeover could duplicate a push after an unknown worker exit.
        onFailure(
          new Error(
            `Wallet-credit push release failed after retry: ${release.error}`
          )
        );
        return;
      }
      ownsClaim = false;
    } catch (error: unknown) {
      onFailure(error);
    }
  };

  try {
    let claim = await claimWalletCreditPush(claimArgs);
    if (claim.status === 'error') {
      claim = await claimWalletCreditPush(claimArgs);
    }
    if (claim.status === 'error') {
      onFailure(
        new Error(`Wallet-credit push claim failed after retry: ${claim.error}`)
      );
      return;
    }
    if (claim.status === 'already_claimed') {
      return;
    }
    ownsClaim = true;

    const delivery = await notify();
    if (delivery.status === 'retryable_error') {
      await releaseClaim();
    }
  } catch (error: unknown) {
    if (ownsClaim) {
      await releaseClaim();
    }
    onFailure(error);
  }
}
