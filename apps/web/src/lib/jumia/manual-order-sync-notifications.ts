import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyJumiaOrder } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import type { JumiaOrderWrite } from './manual-order-sync-types';
import { mapWithBoundedConcurrency } from './manual-order-sync-utils';
import {
  claimJumiaNotificationDelivery,
  isJumiaNotificationAlreadySent,
  markJumiaNotificationSent,
  releaseJumiaNotificationDeliveryClaim,
} from './order-sync-notifications';
import { chunkOrderIds } from './order-sync-operations';

const JUMIA_ORDER_LOOKUP_CONCURRENCY = 4;

async function releaseManualJumiaNotificationClaim({
  claimedAt,
  orderId,
  merchantId,
  supabase,
}: {
  claimedAt: string;
  orderId: string;
  merchantId: string;
  supabase: SupabaseClient;
}) {
  try {
    const releaseError = await releaseJumiaNotificationDeliveryClaim(
      supabase,
      merchantId,
      orderId,
      claimedAt
    );
    if (releaseError) {
      logger.error({
        message: 'Failed to release Jumia notification delivery lease',
        orderId,
        error: releaseError,
      });
    }
    return releaseError;
  } catch (releaseError) {
    logger.error({
      message: 'Failed to release Jumia notification delivery lease',
      orderId,
      error: releaseError,
    });
    return releaseError instanceof Error
      ? { message: releaseError.message }
      : { message: 'Unknown Jumia notification lease release error' };
  }
}

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
      let alreadySent = false;
      try {
        alreadySent = await isJumiaNotificationAlreadySent(
          supabase,
          merchantId,
          write.orderId
        );
      } catch (sentCheckError) {
        markerFailed = true;
        logger.error({
          message: 'Failed to verify Jumia notification sent state',
          orderId: write.orderId,
          error: sentCheckError,
        });
        continue;
      }
      if (alreadySent) {
        currentlyNotifiedOrderIds.add(write.orderId);
        continue;
      }
      markerFailed = true;
      logger.error({
        message: 'Jumia order notification delivery is already leased',
        orderId: write.orderId,
      });
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
        markerFailed = true;
        await releaseManualJumiaNotificationClaim({
          claimedAt: claim.claimedAt,
          orderId: write.orderId,
          merchantId,
          supabase,
        });
        logger.error({
          message: 'No Jumia order push notifications were accepted',
          orderId: write.orderId,
          orderNumber: write.orderNumber,
          deliveryResult,
        });
        continue;
      }
    } catch (pushError) {
      markerFailed = true;
      await releaseManualJumiaNotificationClaim({
        claimedAt: claim.claimedAt,
        orderId: write.orderId,
        merchantId,
        supabase,
      });
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
