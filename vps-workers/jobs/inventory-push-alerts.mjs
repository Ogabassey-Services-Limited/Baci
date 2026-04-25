/**
 * VPS worker: inventory-push-alerts
 * Replaces /api/inventory/push-alerts running on Vercel.
 * Runs directly against Supabase + Expo.
 */

import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createExpoClient, notifyMerchant } from '../lib/push.mjs';

const MAX_NOTIFICATION_ATTEMPTS = 3;
const DEFAULT_ALERT_THRESHOLD = 5;

export function getAlertNotification(alertType) {
  switch (alertType) {
    case 'stockout':
      return {
        type: 'stockout',
        title: 'Stockout Alert',
        buildBody: (productName) => `${productName} is out of stock`,
      };
    case 'reorder_point':
      return {
        type: 'reorder_point',
        title: 'Reorder Point Alert',
        buildBody: (productName, currentStock, threshold) =>
          `${productName} has reached its reorder point (${currentStock} remaining, threshold: ${threshold})`,
      };
    default:
      return {
        type: 'low_stock',
        title: 'Low Stock Alert',
        buildBody: (productName, currentStock, threshold) =>
          `${productName} is low on stock (${currentStock} remaining, threshold: ${threshold})`,
      };
  }
}

async function markAlertNotificationProcessed({ supabase, alertId, now }) {
  const { error } = await supabase
    .from('inventory_alerts')
    .update({
      notification_sent: true,
      notification_sent_at: now(),
    })
    .eq('id', alertId);

  return error ?? null;
}

async function recordAlertNotificationFailure({ supabase, alert, now }) {
  const attempts = Number(alert.notification_attempts ?? 0) + 1;
  const reachedAttemptLimit = attempts >= MAX_NOTIFICATION_ATTEMPTS;
  const update = { notification_attempts: attempts };

  if (reachedAttemptLimit) {
    update.notification_sent = true;
    update.notification_sent_at = now();
  }

  const { error } = await supabase
    .from('inventory_alerts')
    .update(update)
    .eq('id', alert.id);

  return { attempts, reachedAttemptLimit, error: error ?? null };
}

export async function runInventoryPushAlerts({
  supabase,
  expo,
  now = () => new Date().toISOString(),
  logger = console,
  notify = notifyMerchant,
}) {
  const { data: alerts, error } = await supabase
    .from('inventory_alerts')
    .select(`
      id,
      merchant_id,
      alert_type,
      current_stock,
      threshold,
      notification_attempts,
      days_until_stockout,
      products (
        id,
        name
      )
    `)
    .eq('status', 'active')
    .eq('notification_sent', false)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  if (!alerts || alerts.length === 0) {
    logger.log('[inventory-push-alerts] No new alerts to notify');
    return {
      total: 0,
      sent: 0,
      skippedNoTokens: 0,
      failed: 0,
      partialFailures: 0,
      updateFailures: 0,
    };
  }

  let sentCount = 0;
  let skippedNoTokens = 0;
  let failedCount = 0;
  let partialFailures = 0;
  let updateFailures = 0;

  for (const alert of alerts) {
    try {
      const products = Array.isArray(alert.products)
        ? alert.products[0]
        : alert.products;
      const productName = products?.name || 'Unknown Product';
      const productId = products?.id ?? null;
      const threshold = alert.threshold ?? DEFAULT_ALERT_THRESHOLD;
      const notification = getAlertNotification(alert.alert_type);

      const result = await notify({
        supabase,
        expo,
        merchantId: alert.merchant_id,
        title: notification.title,
        body: notification.buildBody(
          productName,
          alert.current_stock,
          threshold
        ),
        data: {
          type: notification.type,
          product_id: productId,
          product_name: productName,
          current_stock: alert.current_stock,
          threshold,
        },
        channelId: 'stock',
      });

      if (result.sent === 0 && result.failed > 0) {
        failedCount++;
        const failureUpdate = await recordAlertNotificationFailure({
          supabase,
          alert,
          now,
        });
        if (failureUpdate.error) {
          updateFailures++;
          logger.error(
            '[inventory-push-alerts] Failed to record alert notification failure:',
            alert.id,
            failureUpdate.error
          );
        } else if (failureUpdate.reachedAttemptLimit) {
          logger.warn(
            '[inventory-push-alerts] Notification attempt limit reached; marked alert processed:',
            alert.id,
            failureUpdate.attempts
          );
        }
        continue;
      }

      const updateError = await markAlertNotificationProcessed({
        supabase,
        alertId: alert.id,
        now,
      });

      if (updateError) {
        updateFailures++;
        logger.error(
          '[inventory-push-alerts] Failed to mark alert notified:',
          alert.id,
          updateError
        );
        continue;
      }

      if (result.sent === 0 && result.failed === 0) {
        logger.warn(
          '[inventory-push-alerts] No active push tokens for alert; marked processed to avoid queue clogging:',
          alert.id,
          alert.merchant_id
        );
        skippedNoTokens++;
        continue;
      }

      if (result.failed > 0) {
        partialFailures++;
        logger.warn(
          '[inventory-push-alerts] Alert notification had partial push failures:',
          alert.id,
          alert.merchant_id,
          { sent: result.sent, failed: result.failed }
        );
      }

      sentCount++;
    } catch (pushError) {
      failedCount++;
      const failureUpdate = await recordAlertNotificationFailure({
        supabase,
        alert,
        now,
      });
      if (failureUpdate.error) {
        updateFailures++;
        logger.error(
          '[inventory-push-alerts] Failed to record alert notification exception:',
          alert.id,
          failureUpdate.error
        );
      } else if (failureUpdate.reachedAttemptLimit) {
        logger.warn(
          '[inventory-push-alerts] Exception attempt limit reached; marked alert processed:',
          alert.id,
          failureUpdate.attempts
        );
      }
      logger.error(
        '[inventory-push-alerts] Failed to notify alert:',
        alert.id,
        pushError
      );
    }
  }

  const summary = {
    total: alerts.length,
    sent: sentCount,
    skippedNoTokens,
    failed: failedCount,
    partialFailures,
    updateFailures,
  };

  logger.log(
    `[inventory-push-alerts] Done - total=${summary.total}, sent=${summary.sent}, skippedNoTokens=${summary.skippedNoTokens}, failed=${summary.failed}, partialFailures=${summary.partialFailures}, updateFailures=${summary.updateFailures}`
  );

  return summary;
}

async function main() {
  config({ path: new URL('../.env', import.meta.url).pathname });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '[inventory-push-alerts] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const expo = createExpoClient();

  try {
    const summary = await runInventoryPushAlerts({ supabase, expo });
    if (
      summary.updateFailures > 0 ||
      (summary.total > 0 && summary.sent === 0 && summary.skippedNoTokens === 0)
    ) {
      process.exit(1);
    }
  } catch (error) {
    console.error('[inventory-push-alerts] Worker failed:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
