import { logger } from '@/lib/logger';
import { claimWalletCreditPush } from '@/lib/payments/claim-wallet-credit-push';
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
  transactionId: string;
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
  transactionId,
}: ScheduleWalletFundedCreditNotificationArgs): void {
  if (!(Number.isFinite(fundedAmount) && fundedAmount > 0)) {
    return;
  }

  const task = async () => {
    // Atomic post-finalizer claim: concurrent webhooks can both enter the RPC
    // before either sees the intent's updated last-reference fields. Only the
    // UPDATE that still sees no marker may schedule this transfer's push.
    try {
      let claim = await claimWalletCreditPush({
        reference: gatewayReference,
        transactionId,
      });
      if (claim.status === 'error') {
        claim = await claimWalletCreditPush({
          reference: gatewayReference,
          transactionId,
        });
      }
      if (claim.status === 'error') {
        logger.warn({
          error: claim.error,
          gatewayReference,
          message: 'Wallet-funded credit push claim failed after retry',
        });
        return;
      }
      if (claim.status === 'already_claimed') {
        return;
      }

      await notifyWalletCredited({
        amount: fundedAmount,
        currency,
        customerId,
        merchantId,
        returnTo: `/orders/${orderId}`,
      });
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : error,
        gatewayReference,
        message: 'Wallet-funded order credit push notification failed',
      });
    }
  };

  try {
    scheduleAfter(task);
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : error,
      gatewayReference,
      message: 'Wallet-funded order credit push notification failed',
    });
    // If the post-response scheduler itself is unavailable, start the same
    // idempotent task directly. The durable DB claim remains the retry guard,
    // and the task owns all async failures, so the committed payment response
    // is still never converted into a 500.
    void task();
  }
}
