import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationSendResult } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import type { JumiaOrder } from '@/schemas/jumia';
import {
  claimJumiaNotificationDelivery,
  isJumiaNotificationAlreadySent,
  markJumiaNotificationSent,
  releaseJumiaNotificationDeliveryClaim,
} from './order-sync-notifications';
import { notifySyncedJumiaOrder } from './order-sync-operations';

type SyncedJumiaNotificationDeliveryResult = NotificationSendResult & {
  markerErrorMessage?: string;
  retryableMessage?: string;
};

export async function deliverSyncedJumiaOrderNotification({
  baciOrderId,
  integrationId,
  merchantId,
  order,
  supabase,
}: {
  baciOrderId: string;
  integrationId: string;
  merchantId: string;
  order: JumiaOrder;
  supabase: SupabaseClient;
}) {
  const claim = await claimJumiaNotificationDelivery(
    supabase,
    merchantId,
    order.id
  );
  if (claim.error) {
    throw new Error(
      `Failed to claim Jumia notification delivery lease: ${claim.error.message}`
    );
  }
  if (!claim.claimed || !claim.claimedAt) {
    if (await isJumiaNotificationAlreadySent(supabase, merchantId, order.id)) {
      return {
        sent: 0,
        failed: 0,
        errors: [],
      };
    }

    return {
      sent: 0,
      failed: 0,
      errors: [],
      retryableMessage:
        'Jumia order notification delivery is already leased by another sync worker',
    };
  }
  const claimedAt = claim.claimedAt;

  const rawNotificationResult = await notifySyncedJumiaOrder(
    merchantId,
    order,
    baciOrderId
  ).catch(async (error: unknown) => {
    await releaseJumiaNotificationDeliveryClaim(
      supabase,
      merchantId,
      order.id,
      claimedAt
    );
    throw error;
  });

  if (!rawNotificationResult) {
    logger.warn({
      message: 'Jumia order notification returned no delivery result',
      merchantId,
      integrationId,
      jumiaOrderId: order.id,
      baciOrderId,
    });
  }

  const notificationResult: SyncedJumiaNotificationDeliveryResult =
    rawNotificationResult ?? {
      sent: 0,
      failed: 0,
      errors: [],
    };

  if (notificationResult.sent <= 0) {
    await releaseJumiaNotificationDeliveryClaim(
      supabase,
      merchantId,
      order.id,
      claimedAt
    );
    return {
      ...notificationResult,
      retryableMessage:
        notificationResult.failed > 0 || notificationResult.errors.length > 0
          ? undefined
          : 'No merchant push notification delivery was accepted for the Jumia order',
    };
  }

  const notificationUpdateError = await markJumiaNotificationSent(
    supabase,
    merchantId,
    order.id,
    { claimedAt }
  );
  if (notificationUpdateError) {
    return {
      ...notificationResult,
      markerErrorMessage: `Failed to mark Jumia notification as sent: ${notificationUpdateError.message}`,
    };
  }

  return notificationResult;
}
