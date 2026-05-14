import type { Order } from '@baci/shared';
import { supabase } from '@/lib/supabase';
import { buildOrderReportHtml } from './buildOrderReportHtml';
import { buildOrderReportSummary } from './buildOrderReportSummary';
import { loadOrderExportNativeModules } from './loadOrderExportNativeModules';
import type { OrderItemQueryData } from './orderReportTypes';

const ORDER_ITEM_QUERY_BATCH_SIZE = 50;

function chunkOrderIds(orderIds: string[]): string[][] {
  const chunks: string[][] = [];

  for (
    let index = 0;
    index < orderIds.length;
    index += ORDER_ITEM_QUERY_BATCH_SIZE
  ) {
    chunks.push(orderIds.slice(index, index + ORDER_ITEM_QUERY_BATCH_SIZE));
  }

  return chunks;
}

async function loadOrderItemData(
  orders: Order[]
): Promise<OrderItemQueryData[]> {
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) {
    return [];
  }

  const itemData: OrderItemQueryData[] = [];
  const batchErrors: string[] = [];
  let successfulBatchesCount = 0;

  for (const orderIdBatch of chunkOrderIds(orderIds)) {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_id, quantity, price, products(name)')
      .in('order_id', orderIdBatch)
      .returns<OrderItemQueryData[]>();

    if (error) {
      const message = error.message || 'Unknown order item query failure';
      batchErrors.push(message);
      console.warn('Failed to fetch order items:', message);
      continue;
    }

    successfulBatchesCount += 1;
    itemData.push(...(data || []));
  }

  if (batchErrors.length > 0 && successfulBatchesCount === 0) {
    throw new Error(
      `Failed to fetch order items for every report batch: ${batchErrors.join('; ')}`
    );
  }

  return itemData;
}

export async function exportOrderReportPdf(
  orders: Order[],
  dateRangeLabel: string,
  storeName: string = 'My Store',
  logoUrl?: string
): Promise<void> {
  const { Print, Sharing } = await loadOrderExportNativeModules();

  if (!Print || !Sharing) {
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
    UTI: 'public.pdf',
    mimeType: 'application/pdf',
  });
}
