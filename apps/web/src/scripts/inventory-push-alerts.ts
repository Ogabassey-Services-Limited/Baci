import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { notifyLowStock } from '@/lib/expo-push';
import { createAdminClient } from '@/lib/supabase/admin';

interface InventoryAlertProduct {
  id: string;
  name: string;
}

interface InventoryPushAlertRow {
  alert_type: string | null;
  current_stock: number;
  days_until_stockout: number | null;
  id: string;
  merchant_id: string;
  products: InventoryAlertProduct | InventoryAlertProduct[] | null;
  threshold: number | null;
}

export interface InventoryPushAlertsSummary {
  failed?: number;
  message?: string;
  sent: number;
  success: true;
  total?: number;
}

interface InventoryPushAlertsDependencies {
  logger?: Pick<typeof console, 'error' | 'log'>;
  notifyLowStockFn?: typeof notifyLowStock;
  supabase?: ReturnType<typeof createAdminClient>;
}

export class InventoryPushAlertsError extends Error {
  constructor(
    message: string,
    public readonly clientMessage: string
  ) {
    super(message);
    this.name = 'InventoryPushAlertsError';
  }
}

function readProduct(
  products: InventoryAlertProduct | InventoryAlertProduct[] | null
) {
  return Array.isArray(products) ? (products[0] ?? null) : products;
}

export async function sendInventoryPushAlerts({
  logger = console,
  notifyLowStockFn = notifyLowStock,
  supabase = createAdminClient(),
}: InventoryPushAlertsDependencies = {}): Promise<InventoryPushAlertsSummary> {
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
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    logger.error('[Inventory Alerts] Error fetching alerts:', error);
    throw new InventoryPushAlertsError(
      `Failed to fetch alerts: ${error.message}`,
      'Failed to fetch alerts'
    );
  }

  const alertRows = (alerts ?? []) as InventoryPushAlertRow[];
  if (alertRows.length === 0) {
    return {
      message: 'No new alerts to notify',
      sent: 0,
      success: true,
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const alert of alertRows) {
    try {
      const product = readProduct(alert.products);
      const productName = product?.name || 'Unknown Product';
      const threshold = alert.threshold || 5;

      await notifyLowStockFn(
        alert.merchant_id,
        product?.id ?? null,
        productName,
        alert.current_stock,
        threshold
      );

      const updateResult = await supabase
        .from('inventory_alerts')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (updateResult.error) {
        throw updateResult.error;
      }

      sentCount++;
    } catch (pushError) {
      logger.error(
        `[Inventory Alerts] Failed to notify for alert ${alert.id}:`,
        pushError
      );
      failedCount++;
    }
  }

  logger.log(
    `[Inventory Alerts] Sent ${sentCount} push notifications, ${failedCount} failed`
  );

  return {
    failed: failedCount,
    sent: sentCount,
    success: true,
    total: alertRows.length,
  };
}

export async function runInventoryPushAlertsCli(): Promise<number> {
  const summary = await sendInventoryPushAlerts();
  console.log(
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        ...summary,
      },
      null,
      2
    )
  );
  return summary.failed && summary.failed > 0 ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runInventoryPushAlertsCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
