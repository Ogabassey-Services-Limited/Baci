import { buildWalletCreditedPushPayload } from '@baci/shared/lib';
import { isWalletCreditPushEnabled } from '@/env';
import { formatCurrency, notifyCustomer } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_WALLET_CURRENCY = 'NGN';

interface NotifyWalletCreditedInput {
  amount: number;
  currency?: string;
  customerId: string;
  /** Scopes delivery to this merchant's storefront tokens. */
  merchantId: string;
  returnTo?: string;
}

export type NotifyWalletCreditedResult =
  | { status: 'delivery_unknown' }
  | { status: 'not_applicable' }
  | { status: 'retryable_error' }
  | { status: 'sent' };

/**
 * Push-notify a customer that their wallet was credited (async DVA funding).
 *
 * Fire-and-forget by design: intended to run inside `after(...)` so it can never
 * block or alter a payment webhook's 2xx acknowledgement. It resolves the
 * customer's storefront `user_id` from `customer_id` via a service-role lookup
 * (webhook context, no user session). A guest/unlinked customer (null `user_id`)
 * and any resolution failure are a silent no-op so a push is never delivered to
 * the wrong recipient. Gated by the `WALLET_CREDIT_PUSH_ENABLED` flag.
 */
export async function notifyWalletCredited({
  amount,
  currency,
  customerId,
  merchantId,
  returnTo,
}: NotifyWalletCreditedInput): Promise<NotifyWalletCreditedResult> {
  if (!isWalletCreditPushEnabled()) {
    return { status: 'not_applicable' };
  }

  const resolvedCurrency = currency ?? DEFAULT_WALLET_CURRENCY;
  let deliveryStarted = false;
  let deliveryRejected = false;

  try {
    const supabase = createAdminClient();
    const { data: customer, error } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) {
      logger.error({
        message: 'Wallet credit push customer resolution failed',
        customerId,
        error: error.message,
      });
      return { status: 'retryable_error' };
    }

    const userId =
      customer && typeof customer.user_id === 'string'
        ? customer.user_id
        : null;
    if (!userId) {
      // Guest or unlinked customer — no storefront account to notify.
      return { status: 'not_applicable' };
    }

    const formattedAmount = formatCurrency(amount, resolvedCurrency);
    // Shared contract with the mobile navigation handler — see
    // packages/shared/src/lib/push-notification-payloads.ts.
    const payload = buildWalletCreditedPushPayload({
      amount,
      currency: resolvedCurrency,
      returnTo,
    });

    const result = await notifyCustomer(
      userId,
      'Wallet funded',
      `${formattedAmount} was added to your wallet.`,
      payload,
      'payments',
      {
        merchantId,
        onDeliveryStart: () => {
          deliveryStarted = true;
        },
        onDeliveryRejected: () => {
          deliveryRejected = true;
        },
      }
    );
    if (result.sent > 0) {
      if (result.failed > 0 || result.errors.length > 0) {
        logger.error({
          message: 'Wallet credit push partially failed',
          customerId,
          failed: result.failed,
          errors: result.errors,
        });
      }
      return { status: 'sent' };
    }
    if (result.failed > 0 || result.errors.length > 0) {
      return deliveryRejected || !deliveryStarted
        ? { status: 'retryable_error' }
        : { status: 'delivery_unknown' };
    }
    return { status: 'not_applicable' };
  } catch (error) {
    logger.error({
      message: 'Wallet credit push notification failed',
      customerId,
      error: error instanceof Error ? error.message : error,
    });
    return deliveryRejected || !deliveryStarted
      ? { status: 'retryable_error' }
      : { status: 'delivery_unknown' };
  }
}
