import type { SupabaseClient } from '@supabase/supabase-js';
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
  supabase: SupabaseClient;
  transactionId: string;
  transactionMetadata: Record<string, unknown>;
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
  supabase,
  transactionId,
  transactionMetadata,
}: ScheduleWalletFundedCreditNotificationArgs): void {
  if (!(Number.isFinite(fundedAmount) && fundedAmount > 0)) {
    return;
  }

  scheduleAfter(async () => {
    // Atomic post-finalizer claim: concurrent webhooks can both enter the RPC
    // before either sees the intent's updated last-reference fields. Only the
    // UPDATE that still sees no marker may schedule this transfer's push.
    try {
      const { data: claim, error: claimError } = await supabase
        .from('transactions')
        .update({
          metadata: {
            ...transactionMetadata,
            wallet_credit_push_scheduled_at: new Date().toISOString(),
          },
        })
        .eq('id', transactionId)
        .is('metadata->>wallet_credit_push_scheduled_at', null)
        .select('id')
        .maybeSingle<{ id: string }>();

      if (claimError || !claim) {
        if (claimError) {
          logger.warn({
            error: claimError.message,
            gatewayReference,
            message: 'Wallet-funded credit push claim failed',
          });
        }
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
  });
}
