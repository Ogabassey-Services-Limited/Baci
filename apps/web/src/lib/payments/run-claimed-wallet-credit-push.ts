import { claimWalletCreditPush } from '@/lib/payments/claim-wallet-credit-push';
import type { NotifyWalletCreditedResult } from '@/lib/payments/notify-wallet-credited';
import { releaseWalletCreditPush } from '@/lib/payments/release-wallet-credit-push';

const CLAIM_RELEASE_RECHECK_DELAYS_MS = [100, 500, 1500] as const;

function waitForClaimRelease(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

interface RunClaimedWalletCreditPushArgs {
  allowInitialClaim: boolean;
  claimToken: string;
  notify: () => Promise<NotifyWalletCreditedResult>;
  onFailure: (error: unknown) => void;
  reference: string;
  transactionId: string;
  waitForClaimRelease?: (delayMs: number) => Promise<void>;
}

/** Runs one wallet-credit push behind an atomic, retry-aware delivery claim. */
export async function runClaimedWalletCreditPush({
  allowInitialClaim,
  claimToken,
  notify,
  onFailure,
  reference,
  transactionId,
  waitForClaimRelease: waitForRelease = waitForClaimRelease,
}: RunClaimedWalletCreditPushArgs): Promise<void> {
  const claimArgs = {
    allowInitialClaim,
    claimToken,
    reference,
    transactionId,
  };
  const releaseArgs = { claimToken, reference, transactionId };
  const claimWithRetry = async (
    args: typeof claimArgs
  ): Promise<Awaited<ReturnType<typeof claimWalletCreditPush>>> => {
    let claim = await claimWalletCreditPush(args);
    if (claim.status === 'error') {
      claim = await claimWalletCreditPush(args);
    }
    return claim;
  };
  const releaseClaim = async (): Promise<void> => {
    try {
      let release = await releaseWalletCreditPush(releaseArgs);
      if (release.status === 'error') {
        release = await releaseWalletCreditPush(releaseArgs);
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
    } catch (error: unknown) {
      onFailure(error);
    }
  };

  try {
    let claim = await claimWithRetry(claimArgs);
    if (claim.status === 'error') {
      onFailure(
        new Error(`Wallet-credit push claim failed after retry: ${claim.error}`)
      );
      return;
    }
    if (claim.status === 'already_claimed') {
      const retryOnlyClaimArgs = {
        ...claimArgs,
        allowInitialClaim: false,
      };
      for (const delayMs of CLAIM_RELEASE_RECHECK_DELAYS_MS) {
        await waitForRelease(delayMs);
        claim = await claimWithRetry(retryOnlyClaimArgs);
        if (claim.status === 'error') {
          onFailure(
            new Error(
              `Wallet-credit push retry claim failed after retry: ${claim.error}`
            )
          );
          return;
        }
        if (claim.status === 'claimed') {
          break;
        }
      }
      if (claim.status === 'already_claimed') {
        return;
      }
    }
    const delivery = await notify();
    if (delivery.status === 'retryable_error') {
      await releaseClaim();
    }
  } catch (error: unknown) {
    // notify() classifies known pre-delivery failures as retryable_error.
    // An unexpected rejection has an ambiguous delivery outcome, so retaining
    // the claim is safer than releasing it and risking a duplicate push.
    onFailure(error);
  }
}
