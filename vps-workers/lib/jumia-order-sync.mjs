import { getAllOrders, getOrderItems } from './jumia-api.mjs';
import {
  buildCanonicalJumiaOrderPayload,
  buildJumiaCacheRow,
  buildJumiaOrderNumber,
  buildOrderItems,
  buildTrackingToken,
  getCustomerName,
  getJumiaSyncLowerBound,
  JUMIA_EXTERNAL_SOURCE,
  readOrderSyncEnabled,
} from './jumia-mappers.mjs';
import { notifyMerchant } from './push.mjs';

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadExistingJumiaOrders(supabase, merchantId, orderIds) {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('jumia_orders')
    .select('jumia_order_id, notification_sent, baci_order_id')
    .eq('merchant_id', merchantId)
    .in('jumia_order_id', orderIds);
  if (error) throw new Error(`Failed to load Jumia orders: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.jumia_order_id, row]));
}

async function loadExistingCanonicalOrders(supabase, merchantId, orderIds) {
  if (orderIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('orders')
    .select('id, external_id, tracking_token')
    .eq('merchant_id', merchantId)
    .eq('external_source', JUMIA_EXTERNAL_SOURCE)
    .in('external_id', orderIds);
  if (error) throw new Error(`Failed to load Baci orders: ${error.message}`);
  return new Map(
    (data ?? [])
      .filter((row) => row.external_id)
      .map((row) => [row.external_id, row])
  );
}

async function upsertCanonicalOrder(
  supabase,
  integration,
  order,
  items,
  existing
) {
  const payload = buildCanonicalJumiaOrderPayload(
    integration,
    order,
    existing?.tracking_token || buildTrackingToken()
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
    persistedOrder = data;
  }

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

async function notifySyncedJumiaOrder(context, order, baciOrderId) {
  const totalAmount = safeNumber(order.totalAmount?.value);
  const currency = order.totalAmount?.currency || 'NGN';

  return await notifyMerchant({
    supabase: context.supabase,
    expo: context.expo,
    merchantId: context.integration.merchant_id,
    title: 'Jumia Order',
    body: `Order #${order.number} from ${getCustomerName(order)} - ${currency} ${totalAmount.toLocaleString('en-NG')}`,
    data: {
      type: 'new_order',
      source: JUMIA_EXTERNAL_SOURCE,
      order_id: baciOrderId,
      order_number: buildJumiaOrderNumber(order.number),
      jumia_order_id: order.id,
      amount: totalAmount,
      currency,
    },
    channelId: 'orders',
  });
}

async function syncIntegration(context, result) {
  const { supabase, integration } = context;
  if (!readOrderSyncEnabled(integration.sync_config)) return;

  const syncStartedAt = new Date().toISOString();
  const orders = await getAllOrders(supabase, integration, {
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
    const shouldNotify =
      !existingJumia ||
      existingJumia.notification_sent === false ||
      !existingJumia.baci_order_id;
    let items = null;

    try {
      items = await getOrderItems(supabase, integration, order.id);
    } catch (error) {
      console.error(
        '[sync-jumia-orders] Failed to fetch order items:',
        order.id,
        error
      );
    }

    const canonicalOrder = await upsertCanonicalOrder(
      supabase,
      integration,
      order,
      items,
      existingCanonical
    );
    canonicalOrders.set(order.id, canonicalOrder);

    const { error: cacheError } = await supabase
      .from('jumia_orders')
      .upsert(
        buildJumiaCacheRow(
          integration,
          order,
          items,
          existingJumia,
          canonicalOrder.id
        ),
        { onConflict: 'jumia_order_id' }
      );
    if (cacheError) {
      throw new Error(`Failed to cache Jumia order: ${cacheError.message}`);
    }

    if (existingCanonical) result.canonicalUpdated++;
    else result.canonicalCreated++;

    if (shouldNotify) {
      const notifyResult = await notifySyncedJumiaOrder(
        context,
        order,
        canonicalOrder.id
      );
      if (notifyResult.sent > 0) {
        result.notified++;
        const { error: notificationUpdateError } = await supabase
          .from('jumia_orders')
          .update({ notification_sent: true })
          .eq('merchant_id', integration.merchant_id)
          .eq('jumia_order_id', order.id);
        if (notificationUpdateError) {
          console.error(
            '[sync-jumia-orders] Failed to mark notification as sent:',
            integration.merchant_id,
            order.id,
            notificationUpdateError
          );
        }
      }
    }
  }

  result.synced += orders.length;
  const { error } = await supabase
    .from('marketplace_integrations')
    .update({ last_sync_at: syncStartedAt, sync_error: null })
    .eq('id', integration.id);
  if (error) {
    throw new Error(`Failed to update Jumia sync cursor: ${error.message}`);
  }
}

export async function syncJumiaOrdersForActiveIntegrations({ supabase, expo }) {
  const result = {
    integrations: 0,
    synced: 0,
    canonicalCreated: 0,
    canonicalUpdated: 0,
    notified: 0,
    errors: [],
  };

  const { data: integrations, error } = await supabase
    .from('marketplace_integrations')
    .select(
      'id, merchant_id, shop_id, access_token, refresh_token, token_expires_at, last_sync_at, sync_config'
    )
    .eq('platform', JUMIA_EXTERNAL_SOURCE)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to load Jumia integrations: ${error.message}`);
  }

  result.integrations = integrations?.length ?? 0;

  for (const integration of integrations ?? []) {
    try {
      await syncIntegration({ supabase, expo, integration }, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`${integration.merchant_id}: ${message}`);
      const { error: syncErrorUpdateError } = await supabase
        .from('marketplace_integrations')
        .update({ sync_error: message })
        .eq('id', integration.id);
      if (syncErrorUpdateError) {
        console.error(
          '[sync-jumia-orders] Failed to persist sync error:',
          integration.id,
          message,
          syncErrorUpdateError
        );
      }
    }
  }

  return result;
}
