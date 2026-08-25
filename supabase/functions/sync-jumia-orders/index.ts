/**
 * Jumia Order Sync Edge Function
 * Cron job that polls Jumia for new orders and sends push notifications
 *
 * Schedule: Every 5 minutes via Supabase cron
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatJumiaOrderTimestamp } from '../_shared/jumia-order-timestamp.ts';

// Environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Jumia API Configuration — environment-aware
const rawEnv = Deno.env.get('JUMIA_ENVIRONMENT') ?? 'production';
if (rawEnv !== 'staging' && rawEnv !== 'production') {
  throw new Error(
    `Invalid JUMIA_ENVIRONMENT: "${rawEnv}". Must be "staging" or "production".`
  );
}
const JUMIA_ENVIRONMENT = rawEnv;
const JUMIA_API_BASE =
  JUMIA_ENVIRONMENT === 'staging'
    ? 'https://vendor-api-staging.jumia.com'
    : 'https://vendor-api.jumia.com';
const JUMIA_CLIENT_ID = Deno.env.get('JUMIA_CLIENT_ID');
if (!JUMIA_CLIENT_ID) {
  throw new Error('JUMIA_CLIENT_ID environment variable is required');
}
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const MAX_PAGES = 100;

const INTEGRATION_COLUMNS =
  'id, merchant_id, shop_id, access_token, refresh_token, token_expires_at, last_sync_at, sync_config';

interface JumiaOrder {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    ward: string;
    region: string;
    countryName: string;
  } | null;
  totalAmount: {
    currency: string;
    value: number;
  };
}

interface MarketplaceIntegration {
  id: string;
  merchant_id: string;
  shop_id: string;
  access_token: string | null;
  refresh_token: string;
  token_expires_at: string | null;
  last_sync_at: string | null;
  sync_config: {
    stock?: boolean;
    products?: boolean;
    orders?: boolean;
  } | null;
}

interface ProductMapping {
  id: string;
  product_id: string;
  variant_id: string | null;
  jumia_seller_sku: string | null;
  jumia_product_id: string | null;
  baci_stock_at_last_sync: number | null;
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
      client_id: JUMIA_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update in database
  const { error: updateError } = await supabase
    .from('marketplace_integrations')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', integration.id);

  if (updateError) {
    throw new Error(
      `Failed to persist refreshed token: ${updateError.message}`
    );
  }

  // Keep in-memory object consistent so subsequent retries use fresh tokens
  integration.access_token = data.access_token;
  integration.refresh_token = data.refresh_token;
  integration.token_expires_at = expiresAt.toISOString();

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

// Helper: Fetch all orders from Jumia with pagination
async function fetchAllJumiaOrders(
  supabase: ReturnType<typeof createClient>,
  integration: MarketplaceIntegration,
  accessToken: string,
  updatedAfter: string,
  updatedBefore: string
): Promise<JumiaOrder[]> {
  const allOrders: JumiaOrder[] = [];
  let nextToken: string | null = null;
  let pageCount = 0;
  let currentToken = accessToken;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      throw new Error(
        `Reached max page limit (${MAX_PAGES}) — too many orders to sync in one run. ` +
          'Aborting without advancing last_sync_at so the next run retries.'
      );
    }

    // Rate limit: Jumia allows 4 req/sec at MasterShop level
    if (pageCount > 1) {
      await new Promise((r) => setTimeout(r, 250));
    }

    const params = new URLSearchParams({
      updatedAfter,
      updatedBefore,
    });
    if (nextToken) {
      params.set('nextToken', nextToken);
    }

    let response = await fetch(`${JUMIA_API_BASE}/orders?${params}`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
        Accept: 'application/json',
      },
    });

    // Single-retry on TOKEN_EXPIRED: force-refresh and retry once
    if (response.status === 401) {
      console.log(
        `[Jumia Sync] Token expired for integration ${integration.id}, refreshing and retrying`
      );
      currentToken = await refreshToken(supabase, integration);
      response = await fetch(`${JUMIA_API_BASE}/orders?${params}`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable body>');
        throw new Error(
          `Jumia API error after token refresh: ${response.status} - ${body}`
        );
      }
    } else if (!response.ok) {
      const body = await response.text().catch(() => '<unreadable body>');
      throw new Error(`Jumia API error: ${response.status} - ${body}`);
    }

    const data = await response.json();
    const orders: JumiaOrder[] = data.orders || [];
    allOrders.push(...orders);

    nextToken = data.nextToken ?? null;
    if (data.isLastPage) break;
  } while (nextToken);

  return allOrders;
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

/**
 * Given the ordered list of notified order IDs and the settled push results,
 * return only the order IDs where at least one push notification succeeded.
 *
 * Push promises are ordered outer-loop by order, inner-loop by token, so
 * promise index = orderIdx * tokenCount + tokenIdx.
 */
function getSuccessfullyNotifiedOrderIds(
  notifiedOrderIds: string[],
  pushResults: PromiseSettledResult<void>[],
  tokenCount: number
): string[] {
  const failedPushIndices = new Set<number>();
  for (let i = 0; i < pushResults.length; i++) {
    if (pushResults[i].status === 'rejected') {
      failedPushIndices.add(i);
    }
  }

  return notifiedOrderIds.filter((_, orderIdx) => {
    for (let t = 0; t < tokenCount; t++) {
      const promiseIdx = orderIdx * tokenCount + t;
      if (!failedPushIndices.has(promiseIdx)) {
        return true;
      }
    }
    return false;
  });
}

// ── Stock Sync Helpers ──

/**
 * Resolve effective stock for a product, matching getEffectiveProductStock()
 * from packages/shared/src/lib/product-inventory.ts.
 * Prefers stock_quantity when present and non-zero, falls back to legacy stock.
 */
function resolveEffectiveStock(product: {
  stock: unknown;
  stock_quantity: unknown;
}): number {
  const toNonNeg = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v))
      return Math.max(0, Math.trunc(v));
    if (typeof v === 'string' && v.trim().length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    }
    return 0;
  };

  const stockQuantity = toNonNeg(product.stock_quantity);
  const legacyStock = toNonNeg(product.stock);

  if (product.stock_quantity == null) return legacyStock;
  if (stockQuantity === 0 && legacyStock > 0) return legacyStock;
  return stockQuantity;
}

/**
 * Push Baci stock changes to Jumia for a single integration.
 * Returns count of items updated.
 */
async function syncStockForIntegration(
  supabase: ReturnType<typeof createClient>,
  integration: MarketplaceIntegration,
  accessToken: string
): Promise<{ updated: number; skipped: number }> {
  const { data: mappings, error: mappingsError } = await supabase
    .from('jumia_product_mappings')
    .select(
      'id, product_id, variant_id, jumia_seller_sku, jumia_product_id, baci_stock_at_last_sync'
    )
    .eq('merchant_id', integration.merchant_id)
    .eq('jumia_shop_id', integration.shop_id)
    .eq('sync_status', 'synced');

  if (mappingsError || !mappings || mappings.length === 0) {
    return { updated: 0, skipped: 0 };
  }

  // Filter to push-ready mappings
  const pushReady: ProductMapping[] = [];
  let skipped = 0;

  for (const m of mappings) {
    if (!m.jumia_seller_sku?.trim() || !m.jumia_product_id?.trim()) {
      skipped++;
      continue;
    }
    pushReady.push(m as ProductMapping);
  }

  if (pushReady.length === 0) return { updated: 0, skipped };

  // Batch-resolve stock: collect product IDs and variant IDs
  const variantIds = pushReady
    .filter((m) => m.variant_id)
    .map((m) => m.variant_id!);
  const productOnlyIds = pushReady
    .filter((m) => !m.variant_id)
    .map((m) => m.product_id);

  // Fetch variant stock
  const variantStockMap = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', variantIds);
    if (variantsError) {
      console.error(
        `[Jumia Sync] Stock: failed to fetch variant stock for merchant ${integration.merchant_id}:`,
        variantsError.message
      );
    }
    for (const v of variants || []) {
      variantStockMap.set(
        v.id,
        Math.max(0, Math.trunc(Number(v.stock_quantity) || 0))
      );
    }
  }

  // Fetch product stock
  const productStockMap = new Map<string, number>();
  if (productOnlyIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, stock, stock_quantity')
      .in('id', productOnlyIds);
    if (productsError) {
      console.error(
        `[Jumia Sync] Stock: failed to fetch product stock for merchant ${integration.merchant_id}:`,
        productsError.message
      );
    }
    for (const p of products || []) {
      productStockMap.set(p.id, resolveEffectiveStock(p));
    }
  }

  // Build updates for changed stock only
  const stockUpdates: Array<{
    mappingId: string;
    sellerSku: string;
    id: string;
    stock: number;
  }> = [];

  for (const mapping of pushReady) {
    const stock = mapping.variant_id
      ? variantStockMap.get(mapping.variant_id)
      : productStockMap.get(mapping.product_id);

    if (stock === undefined) {
      skipped++;
      continue;
    }

    if (stock === mapping.baci_stock_at_last_sync) continue;

    stockUpdates.push({
      mappingId: mapping.id,
      sellerSku: mapping.jumia_seller_sku!,
      id: mapping.jumia_product_id!,
      stock,
    });
  }

  if (stockUpdates.length === 0) return { updated: 0, skipped };

  // Push to Jumia
  const stockPayload = {
    products: stockUpdates.map(({ sellerSku, id, stock }) => ({
      sellerSku,
      id,
      stock,
    })),
  };

  let currentToken = accessToken;
  let response = await fetch(`${JUMIA_API_BASE}/feeds/products/stock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${currentToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(stockPayload),
  });

  // Retry on 401
  if (response.status === 401) {
    currentToken = await refreshToken(supabase, integration);
    response = await fetch(`${JUMIA_API_BASE}/feeds/products/stock`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(stockPayload),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable body>');
    throw new Error(`Jumia stock feed error: ${response.status} - ${body}`);
  }

  const feedData = await response.json();
  const feedId = feedData.feedId || null;
  const now = new Date().toISOString();

  // Update tracking columns in parallel
  // Supabase client resolves (not rejects) on error, so check .error on each result
  const updateResults = await Promise.all(
    stockUpdates.map(async (update) => {
      const { error } = await supabase
        .from('jumia_product_mappings')
        .update({
          baci_stock_at_last_sync: update.stock,
          last_stock_synced_at: now,
          ...(feedId ? { last_feed_id: feedId } : {}),
        })
        .eq('id', update.mappingId);
      return { mappingId: update.mappingId, error };
    })
  );

  const trackingFailures = updateResults.filter((r) => r.error !== null);
  if (trackingFailures.length > 0) {
    console.error(
      `[Jumia Sync] Stock: ${trackingFailures.length} mapping update(s) failed for merchant ${integration.merchant_id}:`,
      trackingFailures.map((f) => f.mappingId)
    );
  }

  return { updated: stockUpdates.length, skipped };
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
      .select(INTEGRATION_COLUMNS)
      .eq('platform', 'jumia')
      .eq('is_active', true)
      .neq('connection_method', 'self_authorization');

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

        // Capture sync start time once to avoid timestamp drift across pages
        // and to use as last_sync_at so no orders slip through the gap.
        const syncStartedAt = formatJumiaOrderTimestamp(new Date());

        // Use last_sync_at from the integration row as the lower bound so
        // cron pauses or outages longer than 10 minutes don't miss orders.
        // Fall back to 24 hours ago on first sync (when last_sync_at is null).
        const updatedAfter = integration.last_sync_at
          ? formatJumiaOrderTimestamp(integration.last_sync_at)
          : formatJumiaOrderTimestamp(Date.now() - 24 * 60 * 60 * 1000);

        const orders = await fetchAllJumiaOrders(
          supabase,
          integration,
          accessToken,
          updatedAfter,
          syncStartedAt
        );

        console.log(
          `[Jumia Sync] Merchant ${integration.merchant_id}: ${orders.length} orders`
        );

        if (orders.length === 0) {
          // Use the timestamp captured before fetching so subsequent syncs
          // don't miss orders that arrived while we were processing.
          const { error: zeroOrdersSyncError } = await supabase
            .from('marketplace_integrations')
            .update({ last_sync_at: syncStartedAt, sync_error: null })
            .eq('id', integration.id);
          if (zeroOrdersSyncError) {
            console.error(
              `[Jumia Sync] Failed to update last_sync_at for merchant ${integration.merchant_id} (zero orders):`,
              zeroOrdersSyncError.message
            );
          }
          continue;
        }

        // Batch-fetch existing orders to avoid N+1 queries.
        // Chunk the IN list to stay within PostgreSQL parameter limits.
        const CHUNK_SIZE = 500;
        const orderIds = orders.map((o) => o.id);
        type ExistingOrderRow = {
          jumia_order_id: string;
          id: string;
          notification_sent: boolean;
        };
        const existingOrdersData: ExistingOrderRow[] = [];
        let existingOrdersError: { message: string } | null = null;

        for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
          const chunk = orderIds.slice(i, i + CHUNK_SIZE);
          const { data: chunkData, error: chunkError } = await supabase
            .from('jumia_orders')
            .select('jumia_order_id, id, notification_sent')
            .eq('merchant_id', integration.merchant_id)
            .in('jumia_order_id', chunk);

          if (chunkError) {
            existingOrdersError = chunkError;
            break;
          }
          if (chunkData) {
            existingOrdersData.push(...chunkData);
          }
        }

        if (existingOrdersError) {
          console.error(
            `[Jumia Sync] Failed to fetch existing orders for merchant ${integration.merchant_id}:`,
            existingOrdersError
          );
          errors.push(
            `${integration.merchant_id}: existing orders query failed — ${existingOrdersError.message}`
          );
          continue;
        }

        const existingOrderMap = new Map(
          existingOrdersData.map((row) => [row.jumia_order_id, row])
        );

        // Build upsert rows for all orders
        const upsertRows: Record<string, unknown>[] = [];
        const newOrderIds: Set<string> = new Set();

        for (const order of orders) {
          const customerName = order.shippingAddress
            ? `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim()
            : 'Unknown Customer';

          const existingOrder = existingOrderMap.get(order.id);
          const isNewOrder = !existingOrder;

          const baseRow = {
            merchant_id: integration.merchant_id,
            jumia_order_id: order.id,
            jumia_order_number: String(order.number),
            jumia_shop_id: integration.shop_id,
            status: order.status,
            customer_name: customerName,
            shipping_address: order.shippingAddress || {},
            total_amount: order.totalAmount.value,
            currency: order.totalAmount.currency,
            created_at_jumia: order.createdAt,
          };

          // For new orders, include initial defaults; for existing, omit to
          // avoid overwriting fields that may have been enriched elsewhere.
          const upsertRow = isNewOrder
            ? {
                ...baseRow,
                customer_phone: '',
                items: [],
                notification_sent: false,
              }
            : baseRow;

          upsertRows.push(upsertRow);

          if (isNewOrder) {
            newOrderIds.add(order.id);
          }
        }

        // Batch upsert all orders at once
        const { error: upsertError } = await supabase
          .from('jumia_orders')
          .upsert(upsertRows, { onConflict: 'jumia_order_id' });

        if (upsertError) {
          const affectedOrderIds = upsertRows.map(
            (r) => r.jumia_order_id as string
          );
          console.error(
            `[Jumia Sync] Batch upsert error for merchant ${integration.merchant_id}:`,
            upsertError
          );
          errors.push(
            `${integration.merchant_id}: upsert failed for orders [${affectedOrderIds.join(', ')}] — ${upsertError.message}`
          );
          // Skip last_sync_at update on upsert failure to avoid advancing
          // the cursor and silently dropping orders.
        } else {
          totalSynced += orders.length;
        }

        // Send push notifications for new orders (only when upsert succeeded)
        if (newOrderIds.size > 0 && !upsertError) {
          totalNewOrders += newOrderIds.size;

          // Get merchant's push tokens
          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('merchant_id', integration.merchant_id)
            .eq('is_active', true);

          if (pushTokens && pushTokens.length > 0) {
            const notifiedOrderIds: string[] = [];
            const pushPromises: Promise<void>[] = [];

            for (const order of orders) {
              if (!newOrderIds.has(order.id)) continue;

              const customerName = order.shippingAddress
                ? `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim()
                : 'Unknown Customer';

              const formattedAmount = formatAmount(
                order.totalAmount.value,
                order.totalAmount.currency
              );

              for (const { token } of pushTokens) {
                pushPromises.push(
                  sendPushNotification(
                    token,
                    '🟠 Jumia Order',
                    `Order #${order.number} from ${customerName} - ${formattedAmount}`,
                    {
                      type: 'jumia_order',
                      jumia_order_number: String(order.number),
                      amount: order.totalAmount.value,
                      currency: order.totalAmount.currency,
                    }
                  )
                );
              }

              notifiedOrderIds.push(order.id);
            }

            const pushResults = await Promise.allSettled(pushPromises);

            const successfullyNotifiedOrderIds =
              getSuccessfullyNotifiedOrderIds(
                notifiedOrderIds,
                pushResults,
                pushTokens.length
              );

            if (successfullyNotifiedOrderIds.length > 0) {
              const { error: notifUpdateError } = await supabase
                .from('jumia_orders')
                .update({ notification_sent: true })
                .eq('merchant_id', integration.merchant_id)
                .in('jumia_order_id', successfullyNotifiedOrderIds);
              if (notifUpdateError) {
                console.error(
                  `[Jumia Sync] Failed to mark orders as notified for merchant ${integration.merchant_id}:`,
                  notifUpdateError.message
                );
              }
            }
          }
        }

        // Only update last_sync_at when the upsert succeeded so a failed
        // sync doesn't advance the cursor and silently drop orders.
        if (!upsertError) {
          const { error: syncUpdateError } = await supabase
            .from('marketplace_integrations')
            .update({ last_sync_at: syncStartedAt, sync_error: null })
            .eq('id', integration.id);

          if (syncUpdateError) {
            console.error(
              `[Jumia Sync] Failed to update last_sync_at for merchant ${integration.merchant_id}:`,
              syncUpdateError.message
            );
          }
        }

        // Piggyback stock sync if enabled for this integration
        if (integration.sync_config?.stock === true) {
          try {
            const stockToken = await getValidToken(supabase, integration);
            const stockResult = await syncStockForIntegration(
              supabase,
              integration,
              stockToken
            );
            if (stockResult.updated > 0) {
              console.log(
                `[Jumia Sync] Stock: pushed ${stockResult.updated} updates for merchant ${integration.merchant_id}`
              );
            }
          } catch (stockError) {
            const stockMsg =
              stockError instanceof Error
                ? stockError.message
                : 'Unknown stock sync error';
            console.error(
              `[Jumia Sync] Stock sync error for merchant ${integration.merchant_id}:`,
              stockMsg
            );
            // Stock sync failure doesn't block order sync — just log it
          }
        }
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
