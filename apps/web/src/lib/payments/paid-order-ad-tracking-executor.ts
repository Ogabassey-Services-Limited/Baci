import { isEventPipelineEnqueueEnabled } from '@/lib/events/event-pipeline-config';
import { logger } from '@/lib/logger';
import type { StepExecutor } from '@/lib/payments/apply-paid-order-side-effects';
import type {
  PaidOrderSideEffectTransaction,
  RichPaidOrder,
  ScheduleAfter,
  ServiceRoleClient,
} from '@/lib/payments/paid-order-side-effect-types';
import { scheduleLegacyPurchaseConversion } from '@/lib/payments/schedule-legacy-purchase-conversion';
import {
  type OrderForConversion,
  triggerPurchaseConversion,
} from '@/lib/trigger-purchase-conversion';

export function toOrderForConversion(order: RichPaidOrder): OrderForConversion {
  return {
    ad_tracking: order.ad_tracking ?? null,
    currency: order.currency ?? null,
    customer_email: order.customer_email ?? null,
    customer_id: order.customer_id ?? null,
    customer_name: order.customer_name ?? null,
    customer_phone: order.customer_phone ?? null,
    id: order.id,
    order_items: (order.order_items ?? []).map((item) => ({
      id: item.id ?? null,
      name: item.name ?? null,
      price: item.price ?? null,
      product_id: item.product_id ?? null,
      quantity: item.quantity ?? null,
    })),
    order_number: order.order_number ?? null,
    shipping_address: order.shipping_address
      ? {
          city: order.shipping_address.city ?? null,
          state: order.shipping_address.state ?? null,
        }
      : null,
    total: order.total,
  };
}

export function buildAdTrackingExecutor(args: {
  order: RichPaidOrder;
  scheduleAfter: ScheduleAfter;
  supabase: ServiceRoleClient;
  transaction: PaidOrderSideEffectTransaction;
}): StepExecutor {
  return async () => {
    const conversionOrder = toOrderForConversion(args.order);
    if (isEventPipelineEnqueueEnabled()) {
      await triggerPurchaseConversion(
        args.supabase,
        args.transaction.merchant_id,
        conversionOrder,
        { deliveryMode: 'enqueue_only' }
      );
      const legacyScheduled = scheduleLegacyPurchaseConversion({
        merchantId: args.transaction.merchant_id,
        order: conversionOrder,
        scheduleAfter: args.scheduleAfter,
        supabase: args.supabase,
      });
      return { legacy_scheduled: legacyScheduled, queued: true };
    }

    args.scheduleAfter(async () => {
      try {
        await triggerPurchaseConversion(
          args.supabase,
          args.transaction.merchant_id,
          conversionOrder
        );
      } catch (error) {
        logger.error({
          error,
          message: 'Ad-tracking conversion failed (after-response path)',
          orderId: args.order.id,
        });
      }
    });
    return { scheduled: true };
  };
}
