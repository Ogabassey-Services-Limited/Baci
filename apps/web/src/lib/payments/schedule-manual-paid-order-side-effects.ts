import { after } from 'next/server';
import { logger } from '@/lib/logger';
import { applyPaidOrderSideEffects } from '@/lib/payments/apply-paid-order-side-effects';
import { toOrderForConversion } from '@/lib/payments/paid-order-ad-tracking-executor';
import { buildEmailExecutor } from '@/lib/payments/paid-order-email-executor';
import { toRichPaidOrder } from '@/lib/payments/paid-order-normalization';
import { createServiceClient } from '@/lib/supabase/service';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';

interface ScheduleManualPaidOrderSideEffectsInput {
  actor: string;
  amount: number;
  gatewayReference?: string | null;
  merchantId: string;
  order: unknown;
  transactionId: string;
}

export function scheduleManualPaidOrderSideEffects({
  actor,
  amount,
  gatewayReference = null,
  merchantId,
  order,
  transactionId,
}: ScheduleManualPaidOrderSideEffectsInput) {
  after(async () => {
    try {
      const supabase = createServiceClient();
      const normalizedOrder =
        typeof order === 'object' && order && 'subtotal' in order
          ? { ...order, subtotal: order.subtotal ?? 0 }
          : order;
      const richOrder = toRichPaidOrder(normalizedOrder, { merchantId });
      const { data: merchantDetails, error: merchantFetchError } =
        await supabase
          .from('merchants')
          .select(
            'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number, website_url'
          )
          .eq('id', merchantId)
          .single();

      const result = await applyPaidOrderSideEffects({
        actor,
        executors: {
          ad_tracking_conversion: async () => {
            await triggerPurchaseConversion(
              supabase,
              merchantId,
              toOrderForConversion(richOrder)
            );
            return { source: 'manual_payment' };
          },
          paid_email: buildEmailExecutor({
            actor,
            merchantDetails,
            merchantFetchError,
            order: richOrder,
          }),
        },
        gatewayResponse: { source: 'manual_payment' },
        order: {
          discount_amount: richOrder.discount_amount,
          gift_wrapping_fee: richOrder.gift_wrapping_fee,
          id: richOrder.id,
          merchant_id: richOrder.merchant_id,
          payment_status: 'paid',
          shipping_fee: richOrder.shipping_fee,
          subtotal: richOrder.subtotal,
          tax_amount: richOrder.tax_amount,
          tax_basis: richOrder.tax_basis,
          total: richOrder.total,
        },
        supabase,
        transaction: {
          amount,
          gateway_reference: gatewayReference,
          id: transactionId,
          merchant_id: merchantId,
          order_id: richOrder.id,
        },
      });
      if (result.failedSteps.length > 0) {
        logger.error({
          actor,
          failedSteps: result.failedSteps,
          message: 'Manual paid-order side effects completed with failures',
          orderId: richOrder.id,
          transactionId,
        });
      }
    } catch (error) {
      logger.error({
        actor,
        error,
        message: 'Manual paid-order side effects failed after response',
        orderId:
          typeof order === 'object' && order && 'id' in order
            ? order.id
            : undefined,
        transactionId,
      });
    }
  });
}
