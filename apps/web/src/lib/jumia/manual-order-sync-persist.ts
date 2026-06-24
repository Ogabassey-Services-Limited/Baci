import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { mapWithBoundedConcurrency } from './manual-order-sync-concurrency';
import type {
  ExistingJumiaOrderLookup,
  JumiaOrderWrite,
} from './manual-order-sync-types';
import { chunkRecords } from './manual-order-sync-utils';
import { chunkOrderIds } from './order-sync-operations';

const JUMIA_ORDER_UPSERT_BATCH_SIZE = 100;
const JUMIA_ORDER_LOOKUP_CONCURRENCY = 4;

export async function loadManualExistingJumiaOrders(
  supabase: SupabaseClient,
  merchantId: string,
  orderIds: string[]
) {
  const existingOrdersMap = new Map<string, ExistingJumiaOrderLookup>();
  const existingOrderResults = await mapWithBoundedConcurrency(
    chunkOrderIds(orderIds),
    JUMIA_ORDER_LOOKUP_CONCURRENCY,
    async (orderIdChunk) =>
      await supabase
        .from('jumia_orders')
        .select('id, jumia_order_id, notification_sent')
        .eq('merchant_id', merchantId)
        .in('jumia_order_id', orderIdChunk)
  );

  for (const {
    data: existingOrders,
    error: existingOrdersError,
  } of existingOrderResults) {
    if (existingOrdersError) {
      logger.error({
        message: 'Failed to prefetch existing Jumia orders',
        error: existingOrdersError,
      });
      return null;
    }

    for (const existingOrder of existingOrders || []) {
      existingOrdersMap.set(String(existingOrder.jumia_order_id), {
        id: String(existingOrder.id),
        jumia_order_id: String(existingOrder.jumia_order_id),
        notification_sent: Boolean(existingOrder.notification_sent),
      });
    }
  }

  return existingOrdersMap;
}

export async function persistJumiaOrderWrites(
  supabase: SupabaseClient,
  pendingOrderWrites: JumiaOrderWrite[]
) {
  let upsertFailed = false;
  const writeGroups = new Map<string, JumiaOrderWrite[]>();
  const persistedOrderWrites: JumiaOrderWrite[] = [];

  for (const write of pendingOrderWrites) {
    const payloadKey = Object.keys(write.upsertPayload).sort().join('\0');
    const writes = writeGroups.get(payloadKey) ?? [];
    writes.push(write);
    writeGroups.set(payloadKey, writes);
  }

  for (const writes of writeGroups.values()) {
    const writeChunks = chunkRecords(writes, JUMIA_ORDER_UPSERT_BATCH_SIZE);
    for (const writeChunk of writeChunks) {
      const payloads = writeChunk.map((write) => write.upsertPayload);
      const { error: upsertError } = await supabase
        .from('jumia_orders')
        .upsert(payloads, {
          defaultToNull: false,
          onConflict: 'jumia_order_id',
        });

      if (!upsertError) {
        persistedOrderWrites.push(...writeChunk);
        continue;
      }

      logger.error({
        message: 'Failed to bulk upsert Jumia orders',
        orderCount: payloads.length,
        persistedOrderCount: persistedOrderWrites.length,
        error: upsertError,
      });
      for (const write of writeChunk) {
        const { error: rowUpsertError } = await supabase
          .from('jumia_orders')
          .upsert(write.upsertPayload, {
            defaultToNull: false,
            onConflict: 'jumia_order_id',
          });
        if (rowUpsertError) {
          upsertFailed = true;
          logger.error({
            message: 'Failed to upsert individual Jumia order',
            orderId: write.orderId,
            error: rowUpsertError,
          });
          continue;
        }
        persistedOrderWrites.push(write);
      }
    }
  }

  return { persistedOrderWrites, upsertFailed };
}
