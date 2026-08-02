import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  type NotificationSendResult,
  notifyCustomer,
  notifyMerchant,
} from '@/lib/expo-push';
import { maybeNotifyActivateProtection } from '@/lib/insurance/notify-activate-protection';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';

const claimedNotificationSchema = z.object({
  audience: z.enum(['merchant', 'customer']),
  id: z.uuid(),
  merchant_id: z.uuid(),
  notification_kind: z.string().min(1),
  order_id: z.uuid(),
  tracking_event_id: z.uuid(),
});

export const claimedGiglTrackingNotificationsSchema = z.array(
  claimedNotificationSchema
);
export type ClaimedGiglTrackingNotification = z.infer<
  typeof claimedNotificationSchema
>;

type WorkerSupabase = SupabaseClient<Database>;
type NotificationProcessingState = { rejectionCompleted: boolean };

const notificationCopy: Record<string, { title: string; body: string }> = {
  delivered: { title: 'Order delivered', body: 'Your delivery has arrived.' },
  out_for_delivery: {
    title: 'Out for delivery',
    body: 'Your order is on its way.',
  },
  picked_up: {
    title: 'Order picked up',
    body: 'GIG Logistics has collected the parcel.',
  },
  pickup_assigned: {
    title: 'Pickup scheduled',
    body: 'GIG Logistics will collect the parcel.',
  },
  pickup_en_route: {
    title: 'Rider en route',
    body: 'A GIG Logistics rider is heading to pickup.',
  },
  pickup_delayed: {
    title: 'Pickup delayed',
    body: 'Your GIG Logistics pickup is taking longer than expected.',
  },
  transit_started: {
    title: 'Order in transit',
    body: 'Your order is moving through GIG Logistics.',
  },
  delivery_attempt_failed: {
    title: 'Delivery attempt unsuccessful',
    body: 'GIG Logistics could not complete the delivery attempt.',
  },
  return_in_progress: {
    title: 'Order being returned',
    body: 'GIG Logistics is returning your order to the sender.',
  },
  shipment_exception: {
    title: 'Shipment exception',
    body: 'GIG Logistics reported an issue with your shipment.',
  },
  failed: {
    title: 'Delivery issue',
    body: 'GIG Logistics reported a delivery issue.',
  },
  returned: {
    title: 'Order returned',
    body: 'GIG Logistics has returned the order to the sender.',
  },
  cancelled: {
    title: 'Shipment cancelled',
    body: 'The GIG Logistics shipment has been cancelled.',
  },
};

const SHIPMENT_UPDATE_CAPABILITY = 1;

function copyFor(kind: string, description: string) {
  return (
    notificationCopy[kind] ?? {
      title: 'Shipment update',
      body: description || 'Your shipment has a new update.',
    }
  );
}

async function complete(
  supabase: WorkerSupabase,
  id: string,
  workerId: string,
  outcome: 'sent' | 'skipped' | 'failed' | 'rejected',
  error?: string
): Promise<boolean> {
  const { data, error: rpcError } = await supabase.rpc(
    'complete_shipment_tracking_notification',
    {
      p_error: error ?? null,
      p_id: id,
      p_outcome: outcome,
      p_worker_id: workerId,
    }
  );
  if (rpcError) throw rpcError;
  return data === true;
}

async function processNotification(
  supabase: WorkerSupabase,
  notification: ClaimedGiglTrackingNotification,
  workerId: string,
  processingState: NotificationProcessingState
) {
  const { data: event, error: eventError } = await supabase
    .from('shipment_tracking_events')
    .select('description')
    .eq('id', notification.tracking_event_id)
    .maybeSingle();
  if (eventError || !event)
    throw eventError ?? new Error('Tracking event missing');

  const copy = copyFor(notification.notification_kind, event.description);
  const payload = { orderId: notification.order_id, type: 'shipment_tracking' };
  if (notification.notification_kind === 'delivered') {
    await notifyDeliveredProtectionActivation(notification.order_id);
  }
  let deliveryRejected = false;
  const onDeliveryStart = async () => {
    const { data: started, error: beginError } = await supabase.rpc(
      'begin_shipment_tracking_notification_dispatch',
      { p_id: notification.id, p_worker_id: workerId }
    );
    if (beginError) throw beginError;
    if (!started) {
      throw new Error(
        'Tracking notification dispatch lease is no longer active'
      );
    }
  };
  const onDeliveryRejected = async () => {
    deliveryRejected = true;
    processingState.rejectionCompleted = await complete(
      supabase,
      notification.id,
      workerId,
      'rejected',
      'all_push_tickets_rejected'
    );
  };
  if (notification.audience === 'merchant') {
    const result = await notifyMerchant(
      notification.merchant_id,
      copy.title,
      copy.body,
      payload,
      'orders',
      {
        onDeliveryStart,
        onDeliveryRejected,
        requiredShipmentUpdateCapability: SHIPMENT_UPDATE_CAPABILITY,
      }
    );
    return completeNotificationResult(
      supabase,
      notification.id,
      workerId,
      result,
      deliveryRejected,
      processingState.rejectionCompleted
    );
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('id', notification.order_id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.customer_id) {
    await complete(
      supabase,
      notification.id,
      workerId,
      'skipped',
      'customer_missing'
    );
    return 'skipped' as const;
  }
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', order.customer_id)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer?.user_id) {
    await complete(
      supabase,
      notification.id,
      workerId,
      'skipped',
      'customer_user_missing'
    );
    return 'skipped' as const;
  }
  const result = await notifyCustomer(
    customer.user_id,
    copy.title,
    copy.body,
    payload,
    'orders',
    {
      merchantId: notification.merchant_id,
      onDeliveryStart,
      onDeliveryRejected,
      requiredShipmentUpdateCapability: SHIPMENT_UPDATE_CAPABILITY,
    }
  );
  return completeNotificationResult(
    supabase,
    notification.id,
    workerId,
    result,
    deliveryRejected,
    processingState.rejectionCompleted
  );
}

async function notifyDeliveredProtectionActivation(orderId: string) {
  try {
    await maybeNotifyActivateProtection(orderId);
  } catch (error) {
    logger.error({
      message: 'Failed to send activate-protection push after GIGL delivery',
      orderId,
      error,
    });
  }
}

async function completeNotificationResult(
  supabase: WorkerSupabase,
  id: string,
  workerId: string,
  result: NotificationSendResult,
  deliveryRejected: boolean,
  rejectionCompleted: boolean
) {
  if (rejectionCompleted) return 'failed' as const;
  // A retry after any accepted ticket can duplicate a customer-visible update.
  if (result.sent > 0) {
    await complete(supabase, id, workerId, 'sent');
    return 'sent' as const;
  }
  if (result.errors.length > 0 || result.failed > 0) {
    await complete(
      supabase,
      id,
      workerId,
      deliveryRejected ? 'rejected' : 'failed'
    );
    return 'failed' as const;
  }
  await complete(supabase, id, workerId, 'skipped', 'no_active_push_token');
  return 'skipped' as const;
}

export async function processClaimedGiglTrackingNotifications(
  supabase: WorkerSupabase,
  notifications: ClaimedGiglTrackingNotification[],
  workerId: string
) {
  const summary = {
    claimed: notifications.length,
    failed: 0,
    sent: 0,
    skipped: 0,
    success: true,
  };
  for (const notification of notifications) {
    const processingState: NotificationProcessingState = {
      rejectionCompleted: false,
    };
    try {
      const outcome = await processNotification(
        supabase,
        notification,
        workerId,
        processingState
      );
      summary[outcome] += 1;
    } catch (error) {
      logger.error({
        message: 'GIGL tracking notification failed',
        notificationId: notification.id,
        error,
      });
      if (!processingState.rejectionCompleted) {
        try {
          await complete(
            supabase,
            notification.id,
            workerId,
            'failed',
            error instanceof Error ? error.message : 'unknown_error'
          );
        } catch (completionError) {
          logger.error({
            message: 'Failed to record GIGL tracking notification failure',
            notificationId: notification.id,
            error: completionError,
          });
        }
      }
      summary.failed += 1;
    }
  }
  return summary;
}
