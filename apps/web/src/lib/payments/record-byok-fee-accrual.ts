import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Records a BYOK fee-accrual ledger row (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 item 6 and Phase 5).
 * BYOK lanes waive the platform fee — money settles directly to the merchant's
 * own gateway account — so every row is written `fee_amount = 0, waived = true`
 * from day one for optionality and "you saved ₦X in fees" messaging.
 *
 * Best-effort: the payment has already been recorded when this runs, so an
 * accrual insert failure is logged, never thrown. Writes via the service-role
 * admin client because `public.byok_fee_accruals` is RLS-locked to inserts
 * from `service_role`.
 */
export async function recordByokFeeAccrual({
  merchantId,
  orderId,
  transactionReference,
  provider,
  currency,
  orderAmount,
}: {
  merchantId: string;
  orderId: string | null;
  transactionReference: string | null;
  provider: string;
  currency: string;
  orderAmount: number;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('byok_fee_accruals').insert({
      merchant_id: merchantId,
      order_id: orderId,
      transaction_reference: transactionReference,
      provider,
      currency,
      order_amount: orderAmount,
      fee_amount: 0,
      waived: true,
    });

    if (error) {
      logger.error({
        message: 'Failed to record BYOK fee accrual',
        merchantId,
        orderId,
        provider,
        error,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to record BYOK fee accrual (threw)',
      merchantId,
      orderId,
      provider,
      error,
    });
  }
}
