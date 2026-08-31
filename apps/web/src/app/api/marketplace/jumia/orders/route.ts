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
import { getJumiaOrderQueryFilters } from '@/lib/jumia/order-query-filters';
import { formatJumiaOrderTimestamp } from '@/lib/jumia/order-sync-mappers';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';
import { logger } from '@/lib/logger';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { sanitizeText } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { getJumiaOrderScope } from './get-jumia-order-scope';

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
    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

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

    // If integrationId is provided, resolve the provider and marketplace IDs
    // used to scope cached orders.
    let orderScope: Awaited<ReturnType<typeof getJumiaOrderScope>> | undefined;
    if (integrationId) {
      orderScope = await getJumiaOrderScope(
        supabase,
        merchantId,
        integrationId
      );

      if (orderScope.kind === 'database_error') {
        return NextResponse.json(
          { error: orderScope.message },
          { status: 500 }
        );
      }
      if (orderScope.kind === 'not_found') {
        return NextResponse.json(
          { error: 'Integration not found' },
          { status: 404 }
        );
      }
      if (orderScope.kind === 'invalid_shop') {
        return NextResponse.json(
          { error: 'Integration is missing a Jumia shop ID' },
          { status: 400 }
        );
      }
    }

    let query = supabase
      .from('jumia_orders')
      .select(
        'id, merchant_id, jumia_order_id, jumia_order_number, jumia_shop_id, status, customer_name, customer_phone, shipping_address, items, total_amount, currency, created_at_jumia, synced_at, updated_at, baci_order_id, notification_sent'
      )
      .eq('merchant_id', merchantId)
      .order('synced_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (orderScope?.kind === 'ok') {
      query = query
        .eq('jumia_shop_id', orderScope.shopId)
        .eq('marketplace_key', orderScope.marketplaceKey);
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
    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

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
      ...getJumiaOrderQueryFilters({
        shopId: jumiaClient.shopId,
        countryCode: jumiaClient.countryCode,
        marketplaceKey: jumiaClient.marketplaceKey,
      }),
    });

    // Sync to our database
    let newOrdersCount = 0;

    for (const order of jumiaOrders) {
      const customerName = getCustomerName(order.shippingAddress);

      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('jumia_orders')
        .select('id, notification_sent')
        .eq('jumia_order_id', order.id)
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (existingOrderError) {
        logger.error({
          message: 'Failed to look up existing Jumia order',
          orderId: order.id,
          error: existingOrderError,
        });
        continue;
      }

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
        jumia_order_id: order.id,
        jumia_order_number: String(order.number),
        jumia_shop_id: jumiaClient.shopId,
        marketplace_key: jumiaClient.marketplaceKey,
        status: order.status,
        customer_name: sanitizedCustomerName,
        customer_phone: sanitizeText(customerPhone, 50),
        shipping_address: sanitizedShippingAddress,
        total_amount: order.totalAmount?.value ?? 0,
        currency: order.totalAmount?.currency ?? 'NGN',
        created_at_jumia: order.createdAt,
        notification_sent: existingOrder?.notification_sent || false,
      };

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

      const { error: upsertError } = await supabase
        .from('jumia_orders')
        .upsert(upsertPayload, { onConflict: 'jumia_order_id' });

      if (upsertError) {
        console.error('[Jumia Orders] Upsert error:', upsertError);
        continue;
      }

      if (isNewOrder) {
        newOrdersCount++;
        try {
          await notifyJumiaOrder(
            merchantId,
            String(order.number),
            sanitizedCustomerName,
            Number(order.totalAmount?.value ?? 0),
            order.totalAmount?.currency ?? 'NGN'
          );

          // Only mark notification_sent after successful notify
          const { error: notifyUpdateError } = await supabase
            .from('jumia_orders')
            .update({ notification_sent: true })
            .eq('jumia_order_id', order.id)
            .eq('merchant_id', merchantId);
          if (notifyUpdateError) {
            logger.error({
              message: 'Failed to update notification_sent flag',
              orderId: order.id,
              error: notifyUpdateError,
            });
          }
        } catch (pushError) {
          logger.error({
            message: 'Push notification failed for Jumia order',
            orderId: order.id,
            orderNumber: order.number,
            error:
              pushError instanceof Error
                ? { message: pushError.message, stack: pushError.stack }
                : pushError,
          });
        }
      }
    }

    // Update last_sync_at only on THIS integration row
    const { error: syncUpdateError } = await supabase
      .from('marketplace_integrations')
      .update({
        last_sync_at: formatJumiaOrderTimestamp(new Date()),
        sync_error: null,
      })
      .eq('id', integrationId)
      .eq('merchant_id', merchantId);

    if (syncUpdateError) {
      console.error(
        '[Jumia Orders] Failed to update last_sync_at:',
        syncUpdateError
      );
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
