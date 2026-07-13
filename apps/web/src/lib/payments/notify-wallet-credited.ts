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
}: NotifyWalletCreditedInput): Promise<void> {
  if (!isWalletCreditPushEnabled()) {
    return;
  }

  const resolvedCurrency = currency ?? DEFAULT_WALLET_CURRENCY;

  try {
    const supabase = createAdminClient();
    const { data: customer, error } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      logger.error({
        message: 'Wallet credit push customer resolution failed',
        customerId,
        error: error.message,
      });
      return;
    }

    const userId =
      customer && typeof customer.user_id === 'string'
        ? customer.user_id
        : null;
    if (!userId) {
      // Guest or unlinked customer — no storefront account to notify.
      return;
    }

    const formattedAmount = formatCurrency(amount, resolvedCurrency);
    // Shared contract with the mobile navigation handler — see
    // packages/shared/src/lib/push-notification-payloads.ts.
    const payload = buildWalletCreditedPushPayload({
      amount,
      currency: resolvedCurrency,
      returnTo,
    });

    await notifyCustomer(
      userId,
      'Wallet funded',
      `${formattedAmount} was added to your wallet.`,
      payload,
      'payments',
      { merchantId }
    );
  } catch (error) {
    logger.error({
      message: 'Wallet credit push notification failed',
      customerId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
