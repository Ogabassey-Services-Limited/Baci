/**
 * Jumia Order Sync Edge Function
 * Cron job that polls Jumia for new orders and sends push notifications
 *
 * Schedule: Every 5 minutes via Supabase cron
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Jumia API Configuration
const JUMIA_API_BASE = 'https://vendor-api.jumia.com';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface JumiaOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  shippingAddress: Record<string, unknown>;
  items: unknown[];
  totalAmount: number;
  currency: string;
}

interface MarketplaceIntegration {
  id: string;
  merchant_id: string;
  shop_id: string;
  access_token: string | null;
  refresh_token: string;
  token_expires_at: string | null;
}

// Helper: Refresh Jumia token
async function refreshToken(
  supabase: ReturnType<typeof createClient>,
  integration: MarketplaceIntegration
): Promise<string> {
  console.log(
    `[Jumia Sync] Refreshing token for integration ${integration.id}`
  );

  const response = await fetch(`${JUMIA_API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update in database
  await supabase
    .from('marketplace_integrations')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', integration.id);

  return data.access_token;
}

// Helper: Get valid access token
async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  integration: MarketplaceIntegration
): Promise<string> {
  if (integration.access_token && integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at);
    const bufferedExpiry = new Date(
      expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS
    );

    if (new Date() < bufferedExpiry) {
      return integration.access_token;
    }
  }

  return await refreshToken(supabase, integration);
}

// Helper: Fetch orders from Jumia
async function fetchJumiaOrders(
  accessToken: string,
  updatedAfter: string
): Promise<JumiaOrder[]> {
  const params = new URLSearchParams({
    updatedAfter,
    updatedBefore: new Date().toISOString(),
  });

  const response = await fetch(`${JUMIA_API_BASE}/orders?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(`Jumia API error: ${response.status}`);
  }

  const data = await response.json();
  return data.orders || [];
}

// Helper: Send push notification via Expo
async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        to: token,
        title,
        body,
        data,
        sound: 'default',
        channelId: 'orders',
        priority: 'high',
      },
    ]),
  });
}

// Helper: Format currency
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Main handler
Deno.serve(async (req) => {
  // Verify authorization (cron jobs send service role key)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes('Bearer')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[Jumia Sync] Starting order sync job');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Fetch all active Jumia integrations
    const { data: integrations, error: intError } = await supabase
      .from('marketplace_integrations')
      .select('*')
      .eq('platform', 'jumia')
      .eq('is_active', true);

    if (intError) {
      throw new Error(`Database error: ${intError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log('[Jumia Sync] No active integrations found');
      return new Response(
        JSON.stringify({ message: 'No active integrations', synced: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Jumia Sync] Processing ${integrations.length} integrations`);

    let totalSynced = 0;
    let totalNewOrders = 0;
    const errors: string[] = [];

    // Process each integration
    for (const integration of integrations) {
      try {
        // Get valid token
        const accessToken = await getValidToken(supabase, integration);

        // Fetch orders updated in the last 10 minutes
        const tenMinutesAgo = new Date(
          Date.now() - 10 * 60 * 1000
        ).toISOString();
        const orders = await fetchJumiaOrders(accessToken, tenMinutesAgo);

        console.log(
          `[Jumia Sync] Merchant ${integration.merchant_id}: ${orders.length} orders`
        );

        // Process each order
        for (const order of orders) {
          const customerName =
            `${order.customer.firstName} ${order.customer.lastName}`.trim();

          // Check if order exists
          const { data: existingOrder } = await supabase
            .from('jumia_orders')
            .select('id, notification_sent')
            .eq('jumia_order_id', order.orderId)
            .single();

          const isNewOrder = !existingOrder;

          // Upsert order
          await supabase.from('jumia_orders').upsert(
            {
              merchant_id: integration.merchant_id,
              jumia_order_id: order.orderId,
              jumia_order_number: order.orderNumber,
              jumia_shop_id: integration.shop_id || 'default',
              status: order.status,
              customer_name: customerName,
              customer_phone: order.customer.phone,
              shipping_address: order.shippingAddress,
              items: order.items,
              total_amount: order.totalAmount,
              currency: order.currency,
              created_at_jumia: order.createdAt,
              notification_sent: existingOrder?.notification_sent || false,
            },
            { onConflict: 'jumia_order_id' }
          );

          totalSynced++;

          // Send push notification for new orders
          if (isNewOrder) {
            totalNewOrders++;

            // Get merchant's push tokens
            const { data: pushTokens } = await supabase
              .from('push_tokens')
              .select('token')
              .eq('merchant_id', integration.merchant_id)
              .eq('is_active', true);

            if (pushTokens && pushTokens.length > 0) {
              const formattedAmount = formatAmount(
                order.totalAmount,
                order.currency
              );

              for (const { token } of pushTokens) {
                await sendPushNotification(
                  token,
                  '🟠 Jumia Order',
                  `Order #${order.orderNumber} from ${customerName} - ${formattedAmount}`,
                  {
                    type: 'jumia_order',
                    jumia_order_number: order.orderNumber,
                    amount: order.totalAmount,
                    currency: order.currency,
                  }
                );
              }

              // Mark as notified
              await supabase
                .from('jumia_orders')
                .update({ notification_sent: true })
                .eq('jumia_order_id', order.orderId);
            }
          }
        }

        // Update last_sync_at
        await supabase
          .from('marketplace_integrations')
          .update({ last_sync_at: new Date().toISOString(), sync_error: null })
          .eq('id', integration.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[Jumia Sync] Error for merchant ${integration.merchant_id}:`,
          errorMessage
        );
        errors.push(`${integration.merchant_id}: ${errorMessage}`);

        // Update sync error
        await supabase
          .from('marketplace_integrations')
          .update({ sync_error: errorMessage })
          .eq('id', integration.id);
      }
    }

    console.log(
      `[Jumia Sync] Completed: ${totalSynced} orders synced, ${totalNewOrders} new`
    );

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        newOrders: totalNewOrders,
        integrations: integrations.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Jumia Sync] Fatal error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
