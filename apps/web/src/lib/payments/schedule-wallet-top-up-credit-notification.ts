import { randomUUID } from 'node:crypto';
import { sanitizeResumableWalletReturnTo } from '@baci/shared/lib';
import { logger } from '@/lib/logger';
import { notifyWalletCredited } from '@/lib/payments/notify-wallet-credited';
import type { ScheduleAfter } from '@/lib/payments/paid-order-side-effect-types';
import { runClaimedWalletCreditPush } from '@/lib/payments/run-claimed-wallet-credit-push';

interface ScheduleWalletTopUpCreditNotificationArgs {
  /** Amount credited to the wallet by `creditWalletTopUp`. */
  amount: number;
  currency?: string;
  customerId: string;
  /** Allows the first ledger-credit winner to create the initial push claim. */
  firstCredit: boolean;
  /** Scopes push delivery to this merchant's storefront tokens. */
  merchantId: string;
  /** Transaction metadata; the onward destination is re-validated from it. */
  metadata: Record<string, unknown>;
  reference: string;
  scheduleAfter: ScheduleAfter;
  /** Transaction row used for the atomic one-time notification claim. */
  transactionId: string;
}

/**
 * Push-notify a wallet TOP-UP credit, from whichever caller actually takes the
 * first credit, or from a later replay carrying a durable retry marker.
 *
 * Two routes can credit the same top-up: the payment webhook and the client
 * confirm route (`/api/storefront/customer/wallet/top-up/confirm`, reached via
 * `waitForWalletTopUpConfirmation` on the card path). They race, and
 * Sequential replays cannot create an initial claim. A confirmed pre-delivery
 * failure releases the claim with a durable retry marker, which permits only a
 * later retry—not arbitrary historical transactions—to claim again.
 *
 * Additive and fire-and-forget: it only ever schedules work through the
 * caller's `after(...)` injector and swallows its own errors, so it cannot
 * block, alter, or fail a payment response — status codes, control flow and
 * idempotency are untouched.
 */
export function scheduleWalletTopUpCreditNotification({
  amount,
  currency,
  customerId,
  firstCredit,
  merchantId,
  metadata,
  reference,
  scheduleAfter,
  transactionId,
}: ScheduleWalletTopUpCreditNotificationArgs): void {
  if (!(Number.isFinite(amount) && amount > 0)) {
    return;
  }

  // Re-validated on read (not just on persist): gateway-supplied metadata is
  // echoed back to us, so the deep-link destination is re-checked against the
  // resumable allowlist before it can ever reach a push payload.
  const returnTo =
    sanitizeResumableWalletReturnTo(metadata.returnTo) ??
    sanitizeResumableWalletReturnTo(metadata.return_to);
  const claimToken = randomUUID();

  const logFailure = (error: unknown) => {
    logger.warn({
      message: 'Wallet-credited push notification failed',
      error: error instanceof Error ? error.message : error,
      reference,
    });
  };

  try {
    scheduleAfter(async () => {
      await runClaimedWalletCreditPush({
        allowInitialClaim: firstCredit,
        claimToken,
        notify: () =>
          notifyWalletCredited({
            amount,
            currency,
            customerId,
            merchantId,
            returnTo,
          }),
        onFailure: logFailure,
        reference,
        transactionId,
      });
    });
  } catch (error: unknown) {
    logFailure(error);
  }
}
