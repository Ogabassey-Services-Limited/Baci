import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyJumiaOrder } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import type { JumiaOrderWrite } from './manual-order-sync-types';
import { mapWithBoundedConcurrency } from './manual-order-sync-utils';
import {
  claimJumiaNotificationDelivery,
  markJumiaNotificationSent,
  releaseJumiaNotificationDeliveryClaim,
} from './order-sync-notifications';
import { chunkOrderIds } from './order-sync-operations';

const JUMIA_ORDER_LOOKUP_CONCURRENCY = 4;

async function loadNotifiedJumiaOrderIds(
  supabase: SupabaseClient,
  merchantId: string,
  orderIds: string[]
) {
  const currentlyNotifiedOrderIds = new Set<string>();
  if (orderIds.length === 0) return currentlyNotifiedOrderIds;

  const notificationStateResults = await mapWithBoundedConcurrency(
    chunkOrderIds(orderIds),
    JUMIA_ORDER_LOOKUP_CONCURRENCY,
    async (orderIdChunk) =>
      await supabase
        .from('jumia_orders')
        .select('jumia_order_id, notification_sent')
        .eq('merchant_id', merchantId)
        .in('jumia_order_id', orderIdChunk)
  );

  for (const {
    data: notificationStates,
    error: notificationStatesError,
  } of notificationStateResults) {
    if (notificationStatesError) {
      logger.error({
        message: 'Failed to refresh Jumia notification state',
        error: notificationStatesError,
      });
      return null;
    }
    for (const state of notificationStates || []) {
      if (state.notification_sent === true) {
        currentlyNotifiedOrderIds.add(String(state.jumia_order_id));
      }
    }
  }

  return currentlyNotifiedOrderIds;
}

export async function sendManualJumiaNotifications(
  supabase: SupabaseClient,
  merchantId: string,
  pendingOrderWrites: JumiaOrderWrite[]
) {
  const notificationCandidateIds = pendingOrderWrites
    .filter((write) => write.isNewOrder || !write.prefetchedNotificationSent)
    .map((write) => write.orderId);
  const currentlyNotifiedOrderIds = await loadNotifiedJumiaOrderIds(
    supabase,
    merchantId,
    notificationCandidateIds
  );
  if (!currentlyNotifiedOrderIds) return { markerFailed: true, newOrders: 0 };

  let markerFailed = false;
  let newOrders = 0;

  for (const write of pendingOrderWrites) {
    const shouldNotify =
      (write.isNewOrder || !write.prefetchedNotificationSent) &&
      !currentlyNotifiedOrderIds.has(write.orderId);
    if (!shouldNotify) continue;
    if (write.isNewOrder) newOrders += 1;

    const claim = await claimJumiaNotificationDelivery(
      supabase,
      merchantId,
      write.orderId
    );
    if (claim.error) {
      markerFailed = true;
      logger.error({
        message: 'Failed to claim Jumia notification delivery lease',
        orderId: write.orderId,
        error: claim.error,
      });
      continue;
    }
    if (!claim.claimed || !claim.claimedAt) {
      currentlyNotifiedOrderIds.add(write.orderId);
      continue;
    }

    try {
      const deliveryResult = await notifyJumiaOrder(
        merchantId,
        write.orderNumber,
        write.sanitizedCustomerName,
        write.totalAmount,
        write.currency
      );
      if (deliveryResult.sent <= 0) {
        await releaseJumiaNotificationDeliveryClaim(
          supabase,
          merchantId,
          write.orderId,
          claim.claimedAt
        );
        logger.error({
          message: 'No Jumia order push notifications were accepted',
          orderId: write.orderId,
          orderNumber: write.orderNumber,
          deliveryResult,
        });
        continue;
      }
    } catch (pushError) {
      await releaseJumiaNotificationDeliveryClaim(
        supabase,
        merchantId,
        write.orderId,
        claim.claimedAt
      );
      logger.error({
        message: 'Push notification failed for Jumia order',
        orderId: write.orderId,
        orderNumber: write.orderNumber,
        error:
          pushError instanceof Error
            ? { message: pushError.message, stack: pushError.stack }
            : pushError,
      });
      continue;
    }

    const notificationUpdateError = await markJumiaNotificationSent(
      supabase,
      merchantId,
      write.orderId,
      { claimedAt: claim.claimedAt }
    );
    if (notificationUpdateError) {
      markerFailed = true;
      logger.error({
        message: 'Failed to mark Jumia order notification as sent',
        orderId: write.orderId,
        error: notificationUpdateError,
      });
      continue;
    }
    currentlyNotifiedOrderIds.add(write.orderId);
  }

  return { markerFailed, newOrders };
}
