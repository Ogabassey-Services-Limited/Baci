import { NextResponse } from 'next/server';
import { notifyLowStock } from '@/lib/expo-push';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/inventory/push-alerts
 *
 * Sends push notifications for new low stock alerts that haven't been notified yet.
 * Designed to be called by a cron job or after inventory snapshots are generated.
 */
export async function POST() {
  try {
    const supabase = createAdminClient();

    // Get all active, unnotified inventory alerts
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
      console.error('[Inventory Alerts] Error fetching alerts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new alerts to notify',
        sent: 0,
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process each alert and send push notification
    for (const alert of alerts) {
      try {
        // Products join can return array or single object depending on relationship
        const products = alert.products as unknown as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        const product = Array.isArray(products) ? products[0] : products;
        const productName = product?.name || 'Unknown Product';
        const threshold = alert.threshold || 5;

        // Send push notification to merchant
        await notifyLowStock(
          alert.merchant_id,
          product?.id ?? null,
          productName,
          alert.current_stock,
          threshold
        );

        // Mark alert as notified
        await supabase
          .from('inventory_alerts')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
          })
          .eq('id', alert.id);

        sentCount++;
      } catch (pushError) {
        console.error(
          `[Inventory Alerts] Failed to notify for alert ${alert.id}:`,
          pushError
        );
        failedCount++;
      }
    }

    console.log(
      `[Inventory Alerts] Sent ${sentCount} push notifications, ${failedCount} failed`
    );

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: alerts.length,
    });
  } catch (error) {
    console.error('[Inventory Alerts] Push notification error:', error);
    return NextResponse.json(
      { error: 'Push notification failed' },
      { status: 500 }
    );
  }
}
