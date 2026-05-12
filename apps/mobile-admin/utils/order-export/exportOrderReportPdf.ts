import type { Order } from '@baci/shared';
import { supabase } from '@/lib/supabase';
import { buildOrderReportHtml } from './buildOrderReportHtml';
import { buildOrderReportSummary } from './buildOrderReportSummary';
import { loadOrderExportNativeModules } from './loadOrderExportNativeModules';
import type { OrderItemQueryData } from './orderReportTypes';

async function loadOrderItemData(
  orders: Order[]
): Promise<OrderItemQueryData[]> {
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, quantity, price, products(name)')
    .in('order_id', orderIds)
    .returns<OrderItemQueryData[]>();

  if (error) {
    console.warn('Failed to fetch order items:', error.message);
    return [];
  }

  return data || [];
}

export async function exportOrderReportPdf(
  orders: Order[],
  dateRangeLabel: string,
  storeName: string = 'My Store',
  logoUrl?: string
): Promise<void> {
  const { Print, Sharing } = await loadOrderExportNativeModules();

  if (!Print) {
    throw new Error('Export modules not available');
  }

  const itemData = await loadOrderItemData(orders);
  const generatedAt = new Date();
  const summary = buildOrderReportSummary(orders, itemData);
  const html = buildOrderReportHtml({
    dateRangeLabel,
    generatedAt,
    logoUrl,
    orders,
    storeName,
    summary,
  });
  const { uri } = await Print.printToFileAsync({ html });

  await Sharing.shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
  });
}
