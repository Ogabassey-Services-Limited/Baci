/**
 * Jumia Orders API Route
 * Fetch and sync Jumia orders for the merchant
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { notifyJumiaOrder } from '@/lib/expo-push';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  JumiaApiError,
  JumiaClient,
  jumiaErrorResponse,
} from '@/lib/jumia/client';
import { chunkOrderIds } from '@/lib/jumia/order-sync-operations';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';
import { logger } from '@/lib/logger';
import { sanitizeText } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

const JUMIA_ORDER_UPSERT_BATCH_SIZE = 100;

/** Deduplicate customer name formatting from Jumia shipping address */
function getCustomerName(
  shippingAddress: { firstName?: string; lastName?: string } | undefined
): string {
  if (!shippingAddress) return 'Unknown Customer';
  return (
    `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() ||
    'Unknown Customer'
  );
}

function chunkRecords<T>(records: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }
  return chunks;
}

/**
 * GET: Fetch cached Jumia orders from our database
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const { searchParams } = new URL(request.url);

    const GetQuerySchema = z.object({
      limit: z.coerce.number().int().min(1).max(1000).prefault(50),
      offset: z.coerce.number().int().min(0).prefault(0),
      status: z.string().min(1).optional(),
      integrationId: z.uuid().optional(),
    });

    const queryParsed = GetQuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      status: searchParams.get('status') || undefined,
      integrationId: searchParams.get('integrationId') || undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'invalid_query_parameters',
        },
        { status: 400 }
      );
    }

    const { limit, offset, status, integrationId } = queryParsed.data;

    // If integrationId is provided, look up the shop ID to scope orders
    let jumiaShopId: string | undefined;
    if (integrationId) {
      const { data: integration, error: integrationError } = await supabase
        .from('marketplace_integrations')
        .select('jumia_shop_id')
        .eq('id', integrationId)
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (integrationError) {
        return NextResponse.json(
          { error: integrationError.message },
          { status: 500 }
        );
      }
      if (!integration) {
        return NextResponse.json(
          { error: 'Integration not found' },
          { status: 404 }
        );
      }
      if (
        !integration.jumia_shop_id ||
        typeof integration.jumia_shop_id !== 'string'
      ) {
        return NextResponse.json(
          { error: 'Integration is missing a Jumia shop ID' },
          { status: 400 }
        );
      }
      jumiaShopId = integration.jumia_shop_id;
    }

    let query = supabase
      .from('jumia_orders')
      .select(
        'id, merchant_id, jumia_order_id, jumia_order_number, jumia_shop_id, status, customer_name, customer_phone, shipping_address, items, total_amount, currency, created_at_jumia, synced_at, updated_at, baci_order_id, notification_sent'
      )
      .eq('merchant_id', merchantId)
      .order('synced_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jumiaShopId) {
      query = query.eq('jumia_shop_id', jumiaShopId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('[Jumia Orders] Database error:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orders: orders || [],
      count: orders?.length || 0,
    });
  } catch (error) {
    console.error('[Jumia Orders] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Sync orders from Jumia (manual trigger)
 * Requires integrationId query param to specify which shop to sync.
 */
export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const { searchParams } = new URL(request.url);
    const rawIntegrationId = searchParams.get('integrationId');

    if (!rawIntegrationId) {
      return NextResponse.json(
        { error: 'integrationId is required' },
        { status: 400 }
      );
    }

    const integrationIdSchema = z.uuid('integrationId must be a valid UUID');
    const parsedIntegrationId = integrationIdSchema.safeParse(rawIntegrationId);
    if (!parsedIntegrationId.success) {
      return NextResponse.json(
        {
          error: 'Invalid integrationId',
          code: 'invalid_integration_id',
        },
        { status: 400 }
      );
    }
    const integrationId = parsedIntegrationId.data;

    // Map JumiaApiError from forIntegration to appropriate HTTP responses
    let jumiaClient: JumiaClient;
    try {
      jumiaClient = await JumiaClient.forIntegration(
        supabase,
        merchantId,
        integrationId
      );
    } catch (clientError) {
      if (clientError instanceof JumiaApiError) {
        return jumiaErrorResponse(clientError);
      }
      throw clientError;
    }

    // Fetch all orders from Jumia (auto-paginating) — last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const jumiaOrders = await getAllOrders(jumiaClient, {
      createdAfter: sevenDaysAgo.toISOString().split('T')[0],
    });

    // Sync to our database
    let newOrdersCount = 0;

    // PREFETCH: Collapse N+1 SELECTs into bounded .in() batches.
    type ExistingJumiaOrderLookup = {
      id: string;
      jumia_order_id: string;
      notification_sent: boolean | null;
    };

    const jumiaOrderIds = Array.from(
      new Set(jumiaOrders.map((order) => String(order.id)))
    );
    const existingOrdersMap = new Map<string, ExistingJumiaOrderLookup>();

    const existingOrderResults = await Promise.all(
      chunkOrderIds(jumiaOrderIds).map((orderIdChunk) =>
        supabase
          .from('jumia_orders')
          .select('id, jumia_order_id, notification_sent')
          .eq('merchant_id', merchantId)
          .in('jumia_order_id', orderIdChunk)
      )
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
        // Fail closed: treating unknown rows as new could reset
        // notification_sent or re-notify customers for already-synced orders.
        return NextResponse.json(
          { error: 'Failed to process orders' },
          { status: 500 }
        );
      }

      for (const existingOrder of existingOrders || []) {
        existingOrdersMap.set(String(existingOrder.jumia_order_id), {
          id: String(existingOrder.id),
          jumia_order_id: String(existingOrder.jumia_order_id),
          notification_sent: Boolean(existingOrder.notification_sent),
        });
      }
    }

    let pendingOrderWrites: Array<{
      currency: string;
      existingOrderId: string;
      isNewOrder: boolean;
      orderId: string;
      orderNumber: string;
      prefetchedNotificationSent: boolean;
      sanitizedCustomerName: string;
      totalAmount: number;
      upsertPayload: Record<string, unknown>;
    }> = [];
    const stagedOrderIds = new Set<string>();
    let upsertFailed = false;

    for (const order of jumiaOrders) {
      const customerName = getCustomerName(order.shippingAddress);
      const orderId = String(order.id);

      if (stagedOrderIds.has(orderId)) {
        continue;
      }
      stagedOrderIds.add(orderId);

      const existingOrder = existingOrdersMap.get(orderId);
      const existingOrderId = existingOrder?.id ?? '';

      const isNewOrder = !existingOrder;

      // Fetch order items from Jumia for richer data
      let itemsFetched = false;
      let orderItems: Array<{
        id: string;
        product: { name: string; sellerSku: string; imageUrl: string };
        status: string;
        itemPrice: number;
        paidPrice: number;
      }> = [];
      try {
        const itemsResponse = await getOrderItems(jumiaClient, order.id);
        orderItems = itemsResponse.items.map((item) => ({
          id: item.id,
          product: item.product,
          status: item.status,
          itemPrice: item.itemPrice,
          paidPrice: item.paidPrice,
        }));
        itemsFetched = true;
      } catch (itemError) {
        logger.error({
          message: 'Failed to fetch items for Jumia order',
          orderId: order.id,
          error:
            itemError instanceof Error
              ? { message: itemError.message, stack: itemError.stack }
              : itemError,
        });
      }

      // Extract phone from shipping address if available (Jumia may include it as an extra field)
      const shippingAddr = order.shippingAddress as
        | (Record<string, unknown> & { phone?: string })
        | undefined;
      const customerPhone =
        typeof shippingAddr?.phone === 'string' ? shippingAddr.phone : '';

      // Sanitize external Jumia fields before DB storage
      const sanitizedCustomerName = sanitizeText(customerName, 200);
      const sanitizedShippingAddress = order.shippingAddress
        ? Object.fromEntries(
            Object.entries(
              order.shippingAddress as Record<string, unknown>
            ).map(([k, v]) => [
              k,
              typeof v === 'string' ? sanitizeText(v, 500) : v,
            ])
          )
        : {};
      // Build upsert payload — only include items when successfully fetched
      // to avoid overwriting previously stored items with an empty array
      const upsertPayload: Record<string, unknown> = {
        merchant_id: merchantId,
        jumia_order_id: orderId,
        jumia_order_number: String(order.number),
        jumia_shop_id: jumiaClient.shopId,
        status: order.status,
        customer_name: sanitizedCustomerName,
        customer_phone: sanitizeText(customerPhone, 50),
        shipping_address: sanitizedShippingAddress,
        total_amount: order.totalAmount?.value ?? 0,
        currency: order.totalAmount?.currency ?? 'NGN',
        created_at_jumia: order.createdAt,
      };
      if (isNewOrder) {
        upsertPayload.notification_sent = false;
      }

      if (itemsFetched) {
        const sanitizedItems = orderItems.map((item) => ({
          ...item,
          product: {
            ...item.product,
            name: sanitizeText(item.product.name, 300),
          },
        }));
        upsertPayload.items = sanitizedItems;
      }

      pendingOrderWrites.push({
        currency: order.totalAmount?.currency ?? 'NGN',
        existingOrderId,
        isNewOrder,
        orderId,
        orderNumber: String(order.number),
        prefetchedNotificationSent: existingOrder?.notification_sent === true,
        sanitizedCustomerName,
        totalAmount: Number(order.totalAmount?.value ?? 0),
        upsertPayload,
      });
    }

    if (pendingOrderWrites.length > 0) {
      const writeGroups = new Map<string, typeof pendingOrderWrites>();
      for (const write of pendingOrderWrites) {
        const payloadKey = Object.keys(write.upsertPayload).sort().join('\0');
        const writes = writeGroups.get(payloadKey) ?? [];
        writes.push(write);
        writeGroups.set(payloadKey, writes);
      }

      const persistedOrderWrites: typeof pendingOrderWrites = [];

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

          if (upsertError) {
            upsertFailed = true;
            logger.error({
              message: 'Failed to bulk upsert Jumia orders',
              orderCount: payloads.length,
              persistedOrderCount: persistedOrderWrites.length,
              error: upsertError,
            });
            break;
          }

          persistedOrderWrites.push(...writeChunk);
        }

        if (upsertFailed) {
          break;
        }
      }

      pendingOrderWrites = persistedOrderWrites;
    }

    const notificationCandidateIds = pendingOrderWrites
      .filter((write) => write.isNewOrder || !write.prefetchedNotificationSent)
      .map((write) => write.orderId);
    const currentlyNotifiedOrderIds = new Set<string>();

    if (notificationCandidateIds.length > 0) {
      const notificationStateResults = await Promise.all(
        chunkOrderIds(notificationCandidateIds).map((orderIdChunk) =>
          supabase
            .from('jumia_orders')
            .select('jumia_order_id, notification_sent')
            .eq('merchant_id', merchantId)
            .in('jumia_order_id', orderIdChunk)
        )
      );

      for (const {
        data: notificationStates,
        error: notificationStatesError,
      } of notificationStateResults) {
        if (notificationStatesError) {
          logger.error({
            message: 'Failed to refresh Jumia notification state',
            error: notificationStatesError,
          });
          return NextResponse.json(
            { error: 'Failed to process orders' },
            { status: 500 }
          );
        }

        for (const state of notificationStates || []) {
          if (state.notification_sent === true) {
            currentlyNotifiedOrderIds.add(String(state.jumia_order_id));
          }
        }
      }
    }

    for (const write of pendingOrderWrites) {
      const shouldNotify =
        (write.isNewOrder || !write.prefetchedNotificationSent) &&
        !currentlyNotifiedOrderIds.has(write.orderId);
      if (!shouldNotify) {
        continue;
      }

      if (write.isNewOrder) {
        newOrdersCount++;
      }
      try {
        await notifyJumiaOrder(
          merchantId,
          write.orderNumber,
          write.sanitizedCustomerName,
          write.totalAmount,
          write.currency
        );

        // Only mark notification_sent after successful notify.
        const { error: notifyUpdateError } = await supabase
          .from('jumia_orders')
          .update({ notification_sent: true })
          .eq('jumia_order_id', write.orderId)
          .eq('merchant_id', merchantId);
        if (notifyUpdateError) {
          logger.error({
            message: 'Failed to update notification_sent flag',
            orderId: write.orderId,
            error: notifyUpdateError,
          });
        } else {
          existingOrdersMap.set(write.orderId, {
            id: write.existingOrderId,
            jumia_order_id: write.orderId,
            notification_sent: true,
          });
        }
      } catch (pushError) {
        logger.error({
          message: 'Push notification failed for Jumia order',
          orderId: write.orderId,
          orderNumber: write.orderNumber,
          error:
            pushError instanceof Error
              ? { message: pushError.message, stack: pushError.stack }
              : pushError,
        });
      }
    }

    if (upsertFailed) {
      return NextResponse.json(
        { error: 'Failed to process orders' },
        { status: 500 }
      );
    }

    // Update last_sync_at only on THIS integration row
    const { error: syncUpdateError } = await supabase
      .from('marketplace_integrations')
      .update({ last_sync_at: new Date().toISOString(), sync_error: null })
      .eq('id', integrationId)
      .eq('merchant_id', merchantId);

    if (syncUpdateError) {
      logger.error({
        message: 'Failed to update Jumia integration last_sync_at',
        integrationId,
        error: syncUpdateError,
      });
    }

    return NextResponse.json({
      success: true,
      synced: jumiaOrders.length,
      newOrders: newOrdersCount,
      message: `Synced ${jumiaOrders.length} orders (${newOrdersCount} new)`,
    });
  } catch (error) {
    console.error('[Jumia Orders] Sync error:', error);
    return NextResponse.json({ error: 'Order sync failed' }, { status: 500 });
  }
}
