import type { SupabaseClient } from '@supabase/supabase-js';
import type { JumiaClient } from '@/lib/jumia/client';
import { getAllOrders } from '@/lib/jumia/orders';
import { buildJumiaOrderWrites } from './manual-order-sync-build';
import { sendManualJumiaNotifications } from './manual-order-sync-notifications';
import {
  loadManualExistingJumiaOrders,
  persistJumiaOrderWrites,
} from './manual-order-sync-persist';
import type { ManualJumiaOrderSyncResult } from './manual-order-sync-types';

export async function syncJumiaOrdersForManualIntegration({
  jumiaClient,
  merchantId,
  supabase,
}: {
  jumiaClient: JumiaClient;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<ManualJumiaOrderSyncResult> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const jumiaOrders = await getAllOrders(jumiaClient, {
    createdAfter: sevenDaysAgo.toISOString().split('T')[0],
  });
  const jumiaOrderIds = Array.from(
    new Set(jumiaOrders.map((order) => String(order.id)))
  );
  const existingOrdersMap = await loadManualExistingJumiaOrders(
    supabase,
    merchantId,
    jumiaOrderIds
  );
  if (!existingOrdersMap) {
    return { newOrders: 0, success: false, synced: jumiaOrders.length };
  }

  const pendingOrderWrites = await buildJumiaOrderWrites(
    jumiaClient,
    merchantId,
    jumiaOrders,
    existingOrdersMap
  );
  const { persistedOrderWrites, upsertFailed } = await persistJumiaOrderWrites(
    supabase,
    pendingOrderWrites
  );
  const { markerFailed, newOrders } = await sendManualJumiaNotifications(
    supabase,
    merchantId,
    persistedOrderWrites
  );

  return {
    newOrders,
    success: !(upsertFailed || markerFailed),
    synced: jumiaOrders.length,
  };
}
