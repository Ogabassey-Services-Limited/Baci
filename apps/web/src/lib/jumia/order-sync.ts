import type { SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { notifyMerchant } from '@/lib/expo-push';
import { JumiaClient } from '@/lib/jumia/client';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';
import { logger } from '@/lib/logger';
import type { JumiaOrder, JumiaOrderItem } from '@/schemas/jumia';
import {
  buildCanonicalJumiaOrderPayload,
  buildJumiaCacheRow,
  buildJumiaOrderNumber,
  buildOrderItems,
  type ExistingJumiaOrderRow,
  type ExistingOrderRow,
  getCustomerName,
  getJumiaSyncLowerBound,
  JUMIA_EXTERNAL_SOURCE,
  type MarketplaceIntegrationRow,
  readOrderSyncEnabled,
} from './order-sync-mappers';

export interface JumiaOrderSyncResult {
  integrations: number;
  synced: number;
  canonicalCreated: number;
  canonicalUpdated: number;
  notified: number;
  errors: string[];
}

async function loadExistingJumiaOrders(
  supabase: SupabaseClient,
  merchantId: string,
  orderIds: string[]
) {
  if (orderIds.length === 0) return new Map<string, ExistingJumiaOrderRow>();

  const { data, error } = await supabase
    .from('jumia_orders')
    .select('jumia_order_id, notification_sent, baci_order_id')
    .eq('merchant_id', merchantId)
    .in('jumia_order_id', orderIds);

  if (error) throw new Error(`Failed to load Jumia orders: ${error.message}`);

  return new Map(
    ((data || []) as ExistingJumiaOrderRow[]).map((row) => [
      row.jumia_order_id,
      row,
    ])
  );
}

async function loadExistingCanonicalOrders(
  supabase: SupabaseClient,
  merchantId: string,
  orderIds: string[]
) {
  if (orderIds.length === 0) return new Map<string, ExistingOrderRow>();

  const { data, error } = await supabase
    .from('orders')
    .select('id, external_id, tracking_token')
    .eq('merchant_id', merchantId)
    .eq('external_source', JUMIA_EXTERNAL_SOURCE)
    .in('external_id', orderIds);

  if (error) throw new Error(`Failed to load Baci orders: ${error.message}`);

  return new Map(
    ((data || []) as ExistingOrderRow[])
      .filter((row) => row.external_id)
      .map((row) => [row.external_id as string, row])
  );
}

async function upsertCanonicalOrder(
  supabase: SupabaseClient,
  integration: MarketplaceIntegrationRow,
  order: JumiaOrder,
  items: JumiaOrderItem[] | null,
  existing: ExistingOrderRow | undefined
) {
  const payload = buildCanonicalJumiaOrderPayload(
    integration,
    order,
    existing?.tracking_token || nanoid(32)
  );
  let persistedOrder = existing;

  if (existing) {
    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to update Baci order: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from('orders')
      .insert(payload)
      .select('id, external_id, tracking_token')
      .single();
    if (error || !data) {
      throw new Error(`Failed to create Baci order: ${error?.message}`);
    }
    persistedOrder = data as ExistingOrderRow;
  }

  if (!persistedOrder) throw new Error('Failed to persist Baci order');

  if (items) {
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', persistedOrder.id);
    if (deleteError) {
      throw new Error(
        `Failed to reset Jumia order items: ${deleteError.message}`
      );
    }

    const orderItems = buildOrderItems(persistedOrder.id, items);
    if (orderItems.length > 0) {
      const { error: insertError } = await supabase
        .from('order_items')
        .insert(orderItems);
      if (insertError) {
        throw new Error(
          `Failed to insert Jumia order items: ${insertError.message}`
        );
      }
    }
  }

  return persistedOrder;
}

async function notifySyncedJumiaOrder(
  merchantId: string,
  order: JumiaOrder,
  baciOrderId: string
) {
  const result = await notifyMerchant(
    merchantId,
    'Jumia Order',
    `Order #${order.number} from ${getCustomerName(order)} - ${order.totalAmount.currency} ${order.totalAmount.value.toLocaleString('en-NG')}`,
    {
      type: 'new_order',
      source: JUMIA_EXTERNAL_SOURCE,
      order_id: baciOrderId,
      order_number: buildJumiaOrderNumber(order.number),
      jumia_order_id: order.id,
      amount: order.totalAmount.value,
      currency: order.totalAmount.currency,
    },
    'orders'
  );

  return result.sent > 0;
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
    const existingJumia = existingJumiaOrders.get(order.id);
    const existingCanonical = canonicalOrders.get(order.id);
    const wasNew = !existingJumia;
    const shouldNotify =
      wasNew ||
      existingJumia?.notification_sent === false ||
      !existingJumia?.baci_order_id;
    let items: JumiaOrderItem[] | null = null;
    try {
      items = (await getOrderItems(client, order.id)).items;
    } catch (error) {
      logger.warn({
        message: 'Failed to load Jumia order items during sync',
        merchantId: integration.merchant_id,
        integrationId: integration.id,
        jumiaOrderId: order.id,
        error,
      });
      items = null;
    }

    const canonicalOrder = await upsertCanonicalOrder(
      supabase,
      integration,
      order,
      items,
      existingCanonical
    );
    canonicalOrders.set(order.id, canonicalOrder);

    const cacheRow = buildJumiaCacheRow(
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

    if (existingCanonical) result.canonicalUpdated += 1;
    else result.canonicalCreated += 1;

    if (shouldNotify) {
      const notified = await notifySyncedJumiaOrder(
        integration.merchant_id,
        order,
        canonicalOrder.id
      );
      if (notified) {
        result.notified += 1;
        const { error: notificationUpdateError } = await supabase
          .from('jumia_orders')
          .update({ notification_sent: true })
          .eq('merchant_id', integration.merchant_id)
          .eq('jumia_order_id', order.id);
        if (notificationUpdateError) {
          logger.error({
            message: 'Failed to mark Jumia order notification as sent',
            merchantId: integration.merchant_id,
            integrationId: integration.id,
            jumiaOrderId: order.id,
            error: notificationUpdateError,
          });
        }
      }
    }
  }

  result.synced += orders.length;
  const { error: syncError } = await supabase
    .from('marketplace_integrations')
    .update({ last_sync_at: syncStartedAt, sync_error: null })
    .eq('id', integration.id);
  if (syncError) {
    throw new Error(`Failed to update Jumia sync cursor: ${syncError.message}`);
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
      await supabase
        .from('marketplace_integrations')
        .update({ sync_error: message })
        .eq('id', integration.id);
    }
  }

  return result;
}
