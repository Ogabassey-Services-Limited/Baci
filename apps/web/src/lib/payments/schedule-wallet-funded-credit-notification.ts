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
  orderId: string;
  scheduleAfter: ScheduleAfter;
}

/**
 * Push-notify the wallet credit produced by a wallet-funded ORDER payment
 * (backgrounded bank-transfer checkout): the DVA transfer credits the wallet
 * and is immediately debited to pay the order, so the generic wallet top-up
 * notification block in the webhook is never reached for this flow.
 *
 * The caller gates this helper on a fresh finalization. Additive and
 * fire-and-forget: scheduled through the caller's `after(...)` injector and
 * swallowing its own errors, so it can never alter the webhook response.
 */
export function scheduleWalletFundedCreditNotification({
  currency,
  customerId,
  fundedAmount,
  gatewayReference,
  merchantId,
  orderId,
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
      returnTo: `/orders/${orderId}`,
    }).catch((error: unknown) => {
      logger.warn({
        message: 'Wallet-funded order credit push notification failed',
        error: error instanceof Error ? error.message : error,
        gatewayReference,
      });
    })
  );
}
