import { sanitizeResumableWalletReturnTo } from '@baci/shared/lib';
import { logger } from '@/lib/logger';
import { notifyWalletCredited } from '@/lib/payments/notify-wallet-credited';
import type { ScheduleAfter } from '@/lib/payments/paid-order-side-effect-types';

interface ScheduleWalletTopUpCreditNotificationArgs {
  /** Amount credited to the wallet by `creditWalletTopUp`. */
  amount: number;
  currency?: string;
  customerId: string;
  /** `creditWalletTopUp().firstCredit` — the notification's idempotency key. */
  firstCredit: boolean;
  /** Scopes push delivery to this merchant's storefront tokens. */
  merchantId: string;
  /** Transaction metadata; the onward destination is re-validated from it. */
  metadata: Record<string, unknown>;
  reference: string;
  scheduleAfter: ScheduleAfter;
}

/**
 * Push-notify a wallet TOP-UP credit, from whichever caller actually takes the
 * first credit.
 *
 * Two routes can credit the same top-up: the payment webhook and the client
 * confirm route (`/api/storefront/customer/wallet/top-up/confirm`, reached via
 * `waitForWalletTopUpConfirmation` on the card path). They race, and
 * `creditWalletTopUp` is idempotent — only the winner sees `firstCredit: true`.
 * Gating the push on `firstCredit` therefore both guarantees the customer is
 * notified regardless of who wins AND that they are notified exactly once: the
 * loser's replay reports `firstCredit: false` and schedules nothing.
 *
 * Known ceiling (unchanged): two CONCURRENT first credits can both pass the
 * pre-RPC ledger check and both report `firstCredit`, so a rare duplicate push
 * is accepted rather than changing a shared payments RPC for a flag-gated
 * notification.
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
}: ScheduleWalletTopUpCreditNotificationArgs): void {
  if (!firstCredit) {
    return;
  }

  if (!(Number.isFinite(amount) && amount > 0)) {
    return;
  }

  // Re-validated on read (not just on persist): gateway-supplied metadata is
  // echoed back to us, so the deep-link destination is re-checked against the
  // resumable allowlist before it can ever reach a push payload.
  const returnTo =
    sanitizeResumableWalletReturnTo(metadata.returnTo) ??
    sanitizeResumableWalletReturnTo(metadata.return_to);

  scheduleAfter(() =>
    notifyWalletCredited({
      amount,
      currency,
      customerId,
      merchantId,
      returnTo,
    }).catch((error: unknown) => {
      logger.warn({
        message: 'Wallet-credited push notification failed',
        error: error instanceof Error ? error.message : error,
        reference,
      });
    })
  );
}
