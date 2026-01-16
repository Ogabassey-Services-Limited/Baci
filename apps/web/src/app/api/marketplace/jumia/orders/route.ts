/**
 * Jumia Orders API Route
 * Fetch and manage Jumia orders for the merchant
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { notifyJumiaOrder } from '@/lib/expo-push';
import { JumiaClient } from '@/lib/jumia/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET: Fetch Jumia orders for the merchant
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

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get cached Jumia orders from our database
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status');

    let query = supabase
      .from('jumia_orders')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('synced_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
 */
export async function POST(_request: NextRequest) {
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

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get Jumia client for this merchant
    const jumiaClient = await JumiaClient.forMerchant(merchant.id);

    if (!jumiaClient) {
      return NextResponse.json(
        {
          error:
            'No Jumia integration found. Please connect your Jumia account first.',
        },
        { status: 400 }
      );
    }

    // Fetch orders from Jumia (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await jumiaClient.getOrders({
      createdAfter: sevenDaysAgo.toISOString().split('T')[0], // Use YYYY-MM-DD format
    });
    const jumiaOrders = result.orders;

    // Sync to our database
    const adminSupabase = createAdminClient();
    let newOrdersCount = 0;

    for (const order of jumiaOrders) {
      const customerName = order.shippingAddress
        ? `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim()
        : 'Unknown Customer';

      // Upsert order
      const { data: existingOrder } = await adminSupabase
        .from('jumia_orders')
        .select('id, notification_sent')
        .eq('jumia_order_id', order.id)
        .single();

      const isNewOrder = !existingOrder;

      const { error: upsertError } = await adminSupabase
        .from('jumia_orders')
        .upsert(
          {
            merchant_id: merchant.id,
            jumia_order_id: order.id,
            jumia_order_number: String(order.number),
            jumia_shop_id: jumiaClient.getShopId(),
            status: order.status,
            customer_name: customerName,
            customer_phone: '', // List API doesn't provide phone directly
            shipping_address: order.shippingAddress || {},
            items: [], // List API doesn't provide items directly, fetch via /order/items if needed
            total_amount: order.totalAmount.value,
            currency: order.totalAmount.currency,
            created_at_jumia: order.createdAt,
            notification_sent: existingOrder?.notification_sent || false,
          },
          {
            onConflict: 'jumia_order_id',
          }
        );

      if (upsertError) {
        console.error('[Jumia Orders] Upsert error:', upsertError);
        continue;
      }

      // Send push notification for new orders
      if (isNewOrder) {
        newOrdersCount++;
        await notifyJumiaOrder(
          merchant.id,
          String(order.number),
          customerName,
          Number(order.totalAmount.value),
          order.totalAmount.currency
        );

        // Mark as notified
        await adminSupabase
          .from('jumia_orders')
          .update({ notification_sent: true })
          .eq('jumia_order_id', order.id);
      }
    }

    // Update last_sync_at on integration
    await adminSupabase
      .from('marketplace_integrations')
      .update({ last_sync_at: new Date().toISOString(), sync_error: null })
      .eq('merchant_id', merchant.id)
      .eq('platform', 'jumia');

    return NextResponse.json({
      success: true,
      synced: jumiaOrders.length,
      newOrders: newOrdersCount,
      message: `Synced ${jumiaOrders.length} orders (${newOrdersCount} new)`,
    });
  } catch (error) {
    console.error('[Jumia Orders] Sync error:', error);

    // Update sync error on integration
    try {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (merchant) {
          const adminSupabase = createAdminClient();
          await adminSupabase
            .from('marketplace_integrations')
            .update({
              sync_error:
                error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('merchant_id', merchant.id)
            .eq('platform', 'jumia');
        }
      }
    } catch {
      // Ignore error logging failure
    }

    console.error('[Jumia Orders] Sync error:', error);

    // Detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    const errorDetails =
      error && typeof error === 'object' && 'issues' in error
        ? JSON.stringify((error as any).issues)
        : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
