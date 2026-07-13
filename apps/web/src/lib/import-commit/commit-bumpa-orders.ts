import type { SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import {
  buildCachedOrderRecord,
  buildOrderInsertPayload,
  buildOrderItems,
  type ExistingOrderRecord,
  getPreviewExistingOrderUpdatedAt,
} from './commit-bumpa-order-payload';
import {
  type CommitProgressCallback,
  createCommitProgress,
} from './import-commit-progress';
import { createImportCustomerResolver } from './resolve-import-customer';

interface CommitBumpaOrdersInput {
  supabase: SupabaseClient;
  merchantId: string;
  importJobId: string;
  orders: NormalizedImportedOrder[];
  onProgress?: CommitProgressCallback;
}
const LOOKUP_CHUNK_SIZE = 150;
const LOOKUP_PAGE_SIZE = 1000;
interface ExistingImportedOrdersPageQuery {
  order(column: string): ExistingImportedOrdersPageQuery;
  range(
    from: number,
    to: number
  ): PromiseLike<{
    data: ExistingOrderRecord[] | null;
    error: { message: string } | null;
  }>;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}
function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
async function fetchExistingImportedOrderPages(
  query: ExistingImportedOrdersPageQuery
) {
  const rows: ExistingOrderRecord[] = [];

  for (let from = 0; ; from += LOOKUP_PAGE_SIZE) {
    const { data, error } = await query.range(
      from,
      from + LOOKUP_PAGE_SIZE - 1
    );
    if (error) {
      throw new Error(
        `Failed to load existing imported orders: ${error.message}`
      );
    }
    const page = data || [];
    rows.push(...page);
    if (page.length < LOOKUP_PAGE_SIZE) {
      return rows;
    }
  }
}

async function loadExistingImportedOrders(
  supabase: SupabaseClient,
  merchantId: string,
  orders: NormalizedImportedOrder[]
) {
  const externalIds = uniqueNonEmpty(
    orders.map((order) => order.externalSourceId)
  );
  const existingOrdersById = new Map<string, ExistingOrderRecord>();

  for (const externalIdChunk of chunkValues(externalIds, LOOKUP_CHUNK_SIZE)) {
    const rows = await fetchExistingImportedOrderPages(
      supabase
        .from('orders')
        .select(
          'id, external_id, tracking_token, updated_at, fulfillment_details, shipping_address'
        )
        .eq('merchant_id', merchantId)
        .eq('external_source', 'bumpa')
        .in('external_id', externalIdChunk)
        .order('id') as unknown as ExistingImportedOrdersPageQuery
    );

    rows.forEach((order) => {
      existingOrdersById.set(order.id, order);
    });
  }

  return Array.from(existingOrdersById.values()).map(
    (order) =>
      ({
        ...order,
        loaded_from_database: true,
      }) satisfies ExistingOrderRecord
  );
}

async function replaceOrderItems(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  order: NormalizedImportedOrder
) {
  const { error } = await supabase.rpc('replace_order_items', {
    p_order_id: orderId,
    p_items: buildOrderItems(orderId, order),
    p_merchant_id: merchantId,
    p_is_import: true,
  });

  if (error) {
    throw new Error(`Failed to replace imported order items: ${error.message}`);
  }
}

function firstReturnedOrderRecord(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return isRecord(value) ? value : null;
}

async function replaceImportedOrderItems(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  order: NormalizedImportedOrder,
  orderPatch: ReturnType<typeof buildOrderInsertPayload>,
  expectedUpdatedAt: string | null | undefined
) {
  const { data, error } = await supabase.rpc(
    'replace_imported_order_items_suppressing_order_notifications',
    {
      p_order_id: orderId,
      p_items: buildOrderItems(orderId, order),
      p_merchant_id: merchantId,
      p_order_patch: orderPatch,
      p_expected_updated_at: expectedUpdatedAt ?? null,
    }
  );

  if (error) {
    throw new Error(`Failed to update imported order: ${error.message}`);
  }

  const updatedOrder = firstReturnedOrderRecord(data);
  if (!updatedOrder) {
    throw new Error('Failed to update imported order: no updated row returned');
  }

  return updatedOrder as ExistingOrderRecord;
}

export async function commitBumpaOrders({
  supabase,
  merchantId,
  importJobId,
  orders,
  onProgress,
}: CommitBumpaOrdersInput) {
  const [customerResolver, existingOrders] = await Promise.all([
    createImportCustomerResolver(supabase, merchantId),
    loadExistingImportedOrders(supabase, merchantId, orders),
  ]);

  const ordersByExternalId = new Map<string, ExistingOrderRecord>();
  for (const existingOrder of existingOrders) {
    if (existingOrder.external_id) {
      ordersByExternalId.set(existingOrder.external_id, existingOrder);
    }
  }

  let createdOrders = 0;
  let updatedOrders = 0;
  let createdCustomers = 0;
  const progress = createCommitProgress(orders.length, onProgress);

  for (const order of orders) {
    const { customerId, createdCustomer } =
      await customerResolver.resolveCustomerId(supabase, order);
    if (createdCustomer) {
      createdCustomers += 1;
    }

    const existingOrder = ordersByExternalId.get(order.externalSourceId);
    const trackingToken = existingOrder?.tracking_token || nanoid(32);
    const payload = buildOrderInsertPayload(
      merchantId,
      importJobId,
      customerId,
      order,
      trackingToken,
      existingOrder
    );

    let orderId = existingOrder?.id || null;
    if (existingOrder) {
      const expectedUpdatedAt = existingOrder.loaded_from_database
        ? getPreviewExistingOrderUpdatedAt(order)
        : existingOrder.updated_at;

      if (!expectedUpdatedAt) {
        throw new Error(
          `Imported order ${order.externalSourceId} is missing its preview timestamp; regenerate the preview before committing updates`
        );
      }

      const updatedOrder = await replaceImportedOrderItems(
        supabase,
        merchantId,
        existingOrder.id,
        order,
        payload,
        expectedUpdatedAt
      );
      updatedOrders += 1;
      ordersByExternalId.set(
        order.externalSourceId,
        buildCachedOrderRecord(
          updatedOrder.id,
          order,
          trackingToken,
          payload,
          updatedOrder
        )
      );
    } else {
      const { data, error } = await supabase
        .from('orders')
        .insert(payload)
        .select(
          'id, external_id, tracking_token, updated_at, fulfillment_details, shipping_address'
        )
        .single();

      if (error || !data) {
        throw new Error(`Failed to create imported order: ${error?.message}`);
      }

      const createdOrder = data as ExistingOrderRecord;
      orderId = createdOrder.id;
      ordersByExternalId.set(
        order.externalSourceId,
        buildCachedOrderRecord(
          createdOrder.id,
          order,
          trackingToken,
          payload,
          createdOrder
        )
      );
      createdOrders += 1;
    }

    if (!orderId) {
      throw new Error('Imported order is missing an id after commit');
    }

    if (!existingOrder) {
      try {
        await replaceOrderItems(supabase, merchantId, orderId, order);
      } catch (error) {
        const { data: deletedOrder, error: cleanupError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId)
          .eq('merchant_id', merchantId)
          .select('id')
          .maybeSingle();

        if (cleanupError || !deletedOrder) {
          throw new Error(
            `${error instanceof Error ? error.message : String(error)}; also failed to delete incomplete imported order ${orderId}: ${
              cleanupError?.message ?? 'no matching row was deleted'
            }`
          );
        }

        throw error;
      }
    }

    await progress.reportNext();
  }

  return { createdOrders, updatedOrders, createdCustomers };
}
