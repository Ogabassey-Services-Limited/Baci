/**
 * VPS worker: inventory-push-alerts
 * Replaces /api/inventory/push-alerts running on Vercel.
 * Runs directly against Supabase + Expo.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createExpoClient, notifyMerchant } from '../lib/push.mjs';

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

function getAlertNotification(alertType) {
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

const { data: alerts, error } = await supabase
  .from('inventory_alerts')
  .select(`
    id,
    merchant_id,
    alert_type,
    current_stock,
    threshold,
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
  console.error('[inventory-push-alerts] Failed to fetch alerts:', error);
  process.exit(1);
}

if (!alerts || alerts.length === 0) {
  console.log('[inventory-push-alerts] No new alerts to notify');
  process.exit(0);
}

let sentCount = 0;
let failedCount = 0;
let updateFailures = 0;

for (const alert of alerts) {
  try {
    const products = Array.isArray(alert.products)
      ? alert.products[0]
      : alert.products;
    const productName = products?.name || 'Unknown Product';
    const productId = products?.id ?? null;
    const threshold = alert.threshold ?? 5;
    const notification = getAlertNotification(alert.alert_type);

    const result = await notifyMerchant({
      supabase,
      expo,
      merchantId: alert.merchant_id,
      title: notification.title,
      body: notification.buildBody(productName, alert.current_stock, threshold),
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
      continue;
    }

    if (result.sent === 0 && result.failed === 0) {
      console.warn(
        '[inventory-push-alerts] No active push tokens for alert:',
        alert.id,
        alert.merchant_id
      );
      failedCount++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('inventory_alerts')
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString(),
      })
      .eq('id', alert.id);

    if (updateError) {
      updateFailures++;
      console.error(
        '[inventory-push-alerts] Failed to mark alert notified:',
        alert.id,
        updateError
      );
      continue;
    }

    sentCount++;
  } catch (pushError) {
    failedCount++;
    console.error(
      '[inventory-push-alerts] Failed to notify alert:',
      alert.id,
      pushError
    );
  }
}

console.log(
  `[inventory-push-alerts] Done — total=${alerts.length}, sent=${sentCount}, failed=${failedCount}, updateFailures=${updateFailures}`
);

if (updateFailures > 0 || (alerts.length > 0 && sentCount === 0)) {
  process.exit(1);
}
