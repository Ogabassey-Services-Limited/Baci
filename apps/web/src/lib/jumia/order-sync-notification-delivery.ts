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
  alreadySent?: boolean;
  markerErrorMessage?: string;
  retryableMessage?: string;
};

async function releaseSyncedJumiaNotificationClaim({
  claimedAt,
  jumiaOrderId,
  merchantId,
  supabase,
}: {
  claimedAt: string;
  jumiaOrderId: string;
  merchantId: string;
  supabase: SupabaseClient;
}) {
  try {
    const releaseError = await releaseJumiaNotificationDeliveryClaim(
      supabase,
      merchantId,
      jumiaOrderId,
      claimedAt
    );
    if (releaseError) {
      logger.error({
        message: 'Failed to release Jumia notification delivery lease',
        merchantId,
        jumiaOrderId,
        error: releaseError,
      });
    }
    return releaseError;
  } catch (releaseError) {
    logger.error({
      message: 'Failed to release Jumia notification delivery lease',
      merchantId,
      jumiaOrderId,
      error: releaseError,
    });
    return releaseError instanceof Error
      ? { message: releaseError.message }
      : { message: 'Unknown Jumia notification lease release error' };
  }
}

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
        alreadySent: true,
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
    await releaseSyncedJumiaNotificationClaim({
      claimedAt,
      jumiaOrderId: order.id,
      merchantId,
      supabase,
    });
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

  const hasProviderFailure =
    notificationResult.failed > 0 || notificationResult.errors.length > 0;
  if (notificationResult.sent <= 0 || hasProviderFailure) {
    const releaseError = await releaseSyncedJumiaNotificationClaim({
      claimedAt,
      jumiaOrderId: order.id,
      merchantId,
      supabase,
    });
    const result: SyncedJumiaNotificationDeliveryResult = {
      ...notificationResult,
    };
    if (releaseError) {
      result.markerErrorMessage = `Failed to release Jumia notification delivery lease: ${releaseError.message}`;
    }
    return result;
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
