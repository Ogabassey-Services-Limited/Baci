import { logger } from '@/lib/logger';
import { notifyWalletCredited } from '@/lib/payments/notify-wallet-credited';
import type { ScheduleAfter } from '@/lib/payments/paid-order-side-effect-types';

interface ScheduleWalletFundedCreditNotificationArgs {
  /** Amount actually credited to the wallet by finalize_wallet_funded_order. */
  fundedAmount: number;
  currency: string;
  customerId: string;
  gatewayReference: string;
  merchantId: string;
  scheduleAfter: ScheduleAfter;
}

/**
 * Push-notify the wallet credit produced by a wallet-funded ORDER payment
 * (backgrounded bank-transfer checkout): the DVA transfer credits the wallet
 * and is immediately debited to pay the order, so the generic wallet top-up
 * notification block in the webhook is never reached for this flow.
 *
 * First-credit gating: `finalize_wallet_funded_order` only runs for an ACTIVE
 * funding intent, and it marks the intent completed. A webhook retry therefore
 * finds no active intent (`findActiveWalletFundingIntentForTransfer` →
 * `{ kind: 'none' }`) and never reaches this call, so a successful finalizer
 * result IS the one-and-only credit for that transfer. Additive and
 * fire-and-forget: scheduled through the caller's `after(...)` injector and
 * swallowing its own errors, so it can never alter the webhook's control flow,
 * status code, or idempotency.
 */
export function scheduleWalletFundedCreditNotification({
  currency,
  customerId,
  fundedAmount,
  gatewayReference,
  merchantId,
  scheduleAfter,
}: ScheduleWalletFundedCreditNotificationArgs): void {
  if (!(Number.isFinite(fundedAmount) && fundedAmount > 0)) {
    return;
  }

  scheduleAfter(() =>
    notifyWalletCredited({
      amount: fundedAmount,
      currency,
      customerId,
      merchantId,
    }).catch((error: unknown) => {
      logger.warn({
        message: 'Wallet-funded order credit push notification failed',
        error: error instanceof Error ? error.message : error,
        gatewayReference,
      });
    })
  );
}
