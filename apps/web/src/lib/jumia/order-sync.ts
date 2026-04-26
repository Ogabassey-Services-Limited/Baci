import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaClient } from '@/lib/jumia/client';
import type { JumiaOrderSyncResult } from '@/lib/jumia/order-sync-result';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';
import { logger } from '@/lib/logger';
import {
  getJumiaSyncLowerBound,
  JUMIA_EXTERNAL_SOURCE,
  type MarketplaceIntegrationRow,
  readOrderSyncEnabled,
} from './order-sync-mappers';
import {
  getJumiaNotificationAttemptKey,
  markJumiaNotificationSent,
} from './order-sync-notifications';
import {
  buildSyncedJumiaCacheRow,
  buildExistingJumiaCacheEntry as cacheEntry,
  loadExistingCanonicalOrders,
  loadExistingJumiaOrders,
  notifySyncedJumiaOrder,
  upsertCanonicalOrder,
} from './order-sync-operations';
import {
  clearFullFailureState,
  MAX_FULL_FAILURES_BEFORE_ADVANCE,
  readFullFailureState,
  withFullFailureState,
} from './order-sync-state';

const JUMIA_ORDER_SYNC_ROUTE = 'jumia/order-sync';
const INITIAL_SYNC_CURSOR = 'initial-sync';

type SyncUpdatePayload = Partial<{ last_sync_at: string }> & {
  sync_config: Record<string, unknown>;
  sync_error: string | null;
};

class JumiaSyncCursorUpdateError extends Error {
  constructor(
    message: string,
    readonly syncUpdate: SyncUpdatePayload
  ) {
    super(message);
    this.name = 'JumiaSyncCursorUpdateError';
    Object.setPrototypeOf(this, JumiaSyncCursorUpdateError.prototype);
  }
}

async function syncIntegration(
  supabase: SupabaseClient,
  integration: MarketplaceIntegrationRow,
  result: JumiaOrderSyncResult
) {
  if (!readOrderSyncEnabled(integration.sync_config)) return;

  const client = await JumiaClient.forIntegration(
    supabase,
    integration.merchant_id,
    integration.id
  );
  const orderErrorsBefore = result.orderErrors;
  let syncedAnyOrder = false;
  let earliestFailedSyncAt: string | null = null;
  let earliestFailedSyncMs: number | null = null;
  const attemptedNotificationKeys = new Set<string>();
  const syncStartedAt = new Date().toISOString();
  const orders = await getAllOrders(client, {
    updatedAfter: getJumiaSyncLowerBound(integration.last_sync_at),
    updatedBefore: syncStartedAt,
    size: 100,
  });

  const existingJumiaOrders = await loadExistingJumiaOrders(
    supabase,
    integration.merchant_id,
    orders.map((order) => order.id)
  );
  const canonicalOrders = await loadExistingCanonicalOrders(
    supabase,
    integration.merchant_id,
    orders.map((order) => order.id)
  );

  for (const order of orders) {
    try {
      const existingJumia = existingJumiaOrders.get(order.id);
      const existingCanonical = canonicalOrders.get(order.id);
      const notificationKey = getJumiaNotificationAttemptKey(
        integration.merchant_id,
        order.id
      );
      const shouldNotify =
        // Legacy cache rows without a durable sent marker are intentionally
        // retried. The per-run key and in-memory marker prevent duplicated
        // Jumia API pages from sending duplicate pushes in the same run.
        (!existingJumia || existingJumia.notification_sent !== true) &&
        !attemptedNotificationKeys.has(notificationKey);
      const items = (await getOrderItems(client, order.id)).items;

      const canonicalOrder = await upsertCanonicalOrder(
        supabase,
        integration,
        order,
        items,
        existingCanonical
      );
      canonicalOrders.set(order.id, canonicalOrder);

      const cacheRow = buildSyncedJumiaCacheRow(
        integration,
        order,
        items,
        existingJumia,
        canonicalOrder.id
      );
      const { error: cacheError } = await supabase
        .from('jumia_orders')
        .upsert(cacheRow, { onConflict: 'jumia_order_id' });
      if (cacheError) {
        throw new Error(`Failed to cache Jumia order: ${cacheError.message}`);
      }
      existingJumiaOrders.set(
        order.id,
        cacheEntry(order.id, cacheRow.notification_sent, canonicalOrder.id)
      );

      if (existingCanonical) result.canonicalUpdated += 1;
      else result.canonicalCreated += 1;

      if (shouldNotify) {
        attemptedNotificationKeys.add(notificationKey);
        const rawNotificationResult = await notifySyncedJumiaOrder(
          integration.merchant_id,
          order,
          canonicalOrder.id
        );
        if (!rawNotificationResult) {
          logger.warn({
            message: 'Jumia order notification returned no delivery result',
            merchantId: integration.merchant_id,
            integrationId: integration.id,
            jumiaOrderId: order.id,
            baciOrderId: canonicalOrder.id,
          });
        }
        const notificationResult = rawNotificationResult ?? {
          sent: 0,
          failed: 0,
          errors: [],
        };
        if (notificationResult.sent > 0) {
          result.notified += 1;
          // The push provider accepted the notification. Keep duplicated Jumia
          // pages in this run from rebuilding a stale cache row as unnotified.
          existingJumiaOrders.set(
            order.id,
            cacheEntry(order.id, true, canonicalOrder.id)
          );
          const notificationUpdateError = await markJumiaNotificationSent(
            supabase,
            integration.merchant_id,
            order.id
          );
          if (notificationUpdateError) {
            logger.error({
              message: 'Failed to mark Jumia order notification as sent',
              merchantId: integration.merchant_id,
              integrationId: integration.id,
              jumiaOrderId: order.id,
              error: notificationUpdateError,
            });
            result.errors.push(
              `${integration.merchant_id}/${order.id}: Failed to mark Jumia notification as sent: ${notificationUpdateError.message}`
            );
          }
        }
        if (
          notificationResult.failed > 0 ||
          notificationResult.errors.length > 0
        ) {
          const failureDetails = [
            ...notificationResult.errors,
            notificationResult.failed > 0 &&
              `${notificationResult.failed} push notification(s) failed`,
          ].filter(Boolean);
          throw new Error(
            `Failed to notify merchant for Jumia order: ${failureDetails.join('; ')}`
          );
        }
      }

      result.synced += 1;
      syncedAnyOrder = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const parsedFailedUpdatedAt = Date.parse(order.updatedAt);
      const failedSyncMs = Number.isFinite(parsedFailedUpdatedAt)
        ? parsedFailedUpdatedAt
        : Date.parse(syncStartedAt);
      const failedSyncAt = new Date(failedSyncMs).toISOString();
      if (
        earliestFailedSyncMs === null ||
        failedSyncMs < earliestFailedSyncMs
      ) {
        earliestFailedSyncAt = failedSyncAt;
        earliestFailedSyncMs = failedSyncMs;
      }
      result.orderErrors += 1;
      result.errors.push(`${integration.merchant_id}/${order.id}: ${message}`);
      logger.error({
        message: 'Failed to process Jumia order during sync',
        merchantId: integration.merchant_id,
        integrationId: integration.id,
        jumiaOrderId: order.id,
        error,
      });
    }
  }

  const integrationOrderErrors = result.orderErrors - orderErrorsBefore;
  let syncUpdate: SyncUpdatePayload;
  if (integrationOrderErrors === 0) {
    syncUpdate = {
      last_sync_at: syncStartedAt,
      sync_error: null,
      sync_config: clearFullFailureState(integration.sync_config),
    };
  } else if (syncedAnyOrder) {
    syncUpdate = {
      last_sync_at: earliestFailedSyncAt ?? syncStartedAt,
      sync_error: `Processed with ${integrationOrderErrors} Jumia order error(s); cursor parked at earliest failed order ${earliestFailedSyncAt ?? syncStartedAt} so failed orders remain retryable`,
      sync_config: clearFullFailureState(integration.sync_config),
    };
  } else {
    const failureCursor = integration.last_sync_at ?? INITIAL_SYNC_CURSOR;
    const previousFailureState = readFullFailureState(integration.sync_config);
    const fullFailureCount =
      previousFailureState?.cursor === failureCursor
        ? previousFailureState.count + 1
        : 1;
    syncUpdate =
      fullFailureCount >= MAX_FULL_FAILURES_BEFORE_ADVANCE
        ? {
            last_sync_at: syncStartedAt,
            sync_error: `All ${integrationOrderErrors} Jumia order(s) failed ${fullFailureCount} consecutive time(s); cursor advanced to ${syncStartedAt} and operators should inspect the logged order errors`,
            sync_config: clearFullFailureState(integration.sync_config),
          }
        : {
            sync_error: `All ${integrationOrderErrors} Jumia order(s) failed; cursor not advanced before retry ${fullFailureCount}/${MAX_FULL_FAILURES_BEFORE_ADVANCE}`,
            sync_config: withFullFailureState(
              integration.sync_config,
              failureCursor,
              fullFailureCount
            ),
          };
  }

  const { error: syncError } = await supabase
    .from('marketplace_integrations')
    .update(syncUpdate)
    .eq('id', integration.id);
  if (syncError) {
    throw new JumiaSyncCursorUpdateError(
      `Failed to update Jumia sync cursor: ${syncError.message}`,
      syncUpdate
    );
  }
}

export async function syncJumiaOrdersForActiveIntegrations(
  supabase: SupabaseClient
): Promise<JumiaOrderSyncResult> {
  const result: JumiaOrderSyncResult = {
    integrations: 0,
    synced: 0,
    canonicalCreated: 0,
    canonicalUpdated: 0,
    notified: 0,
    orderErrors: 0,
    errors: [],
  };

  const { data, error } = await supabase
    .from('marketplace_integrations')
    .select('id, merchant_id, shop_id, last_sync_at, sync_config')
    .eq('platform', JUMIA_EXTERNAL_SOURCE)
    .eq('is_active', true);

  if (error)
    throw new Error(`Failed to load Jumia integrations: ${error.message}`);

  const integrations = (data || []) as MarketplaceIntegrationRow[];
  result.integrations = integrations.length;

  for (const integration of integrations) {
    try {
      await syncIntegration(supabase, integration, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`${integration.merchant_id}: ${message}`);
      logger.error({
        message: 'Jumia order sync failed',
        error,
        integrationId: integration.id,
        merchant_id: integration.merchant_id,
        route: JUMIA_ORDER_SYNC_ROUTE,
        sync_error: message,
      });
      const syncErrorPatch =
        error instanceof JumiaSyncCursorUpdateError
          ? { ...error.syncUpdate, sync_error: message }
          : { sync_error: message };
      const { error: syncErrorUpdateError } = await supabase
        .from('marketplace_integrations')
        .update(syncErrorPatch)
        .eq('id', integration.id);
      if (syncErrorUpdateError) {
        const syncErrorMessage = `Failed to persist Jumia sync error for ${integration.merchant_id}: ${syncErrorUpdateError.message}`;
        result.errors.push(syncErrorMessage);
        logger.error({
          message: 'Failed to persist Jumia sync error',
          error: syncErrorUpdateError,
          integrationId: integration.id,
          merchant_id: integration.merchant_id,
          route: JUMIA_ORDER_SYNC_ROUTE,
          sync_error_update_error: syncErrorUpdateError.message,
        });
      }
    }
  }

  return result;
}
