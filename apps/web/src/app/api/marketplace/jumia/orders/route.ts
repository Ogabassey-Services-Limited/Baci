/**
 * Jumia Orders API Route
 * Fetch and sync Jumia orders for the merchant
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  JumiaApiError,
  JumiaClient,
  jumiaErrorResponse,
} from '@/lib/jumia/client';
import { syncJumiaOrdersForManualIntegration } from '@/lib/jumia/manual-order-sync';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

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

    const syncResult = await syncJumiaOrdersForManualIntegration({
      jumiaClient,
      merchantId,
      supabase,
    });

    if (!syncResult.success) {
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
      synced: syncResult.synced,
      newOrders: syncResult.newOrders,
      message: `Synced ${syncResult.synced} orders (${syncResult.newOrders} new)`,
    });
  } catch (error) {
    console.error('[Jumia Orders] Sync error:', error);
    return NextResponse.json({ error: 'Order sync failed' }, { status: 500 });
  }
}
