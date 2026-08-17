/**
 * Jumia Stock Sync API Route
 * Push Baci stock levels to Jumia for synced product mappings.
 *
 * POST /api/marketplace/jumia/products/stock?integrationId={uuid}
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
import { updateStock } from '@/lib/jumia/feeds';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { getEffectiveStock } from '@/lib/product-stock';
import { createClient } from '@/lib/supabase/server';

interface ProductMapping {
  id: string;
  product_id: string;
  variant_id: string | null;
  jumia_seller_sku: string | null;
  jumia_product_id: string | null;
  baci_stock_at_last_sync: number | null;
}

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
          details: z.flattenError(parsedIntegrationId.error),
        },
        { status: 400 }
      );
    }
    const integrationId = parsedIntegrationId.data;

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    // Load Jumia client (validates integration ownership + active status)
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

    // Fetch synced product mappings for this shop
    const { data: mappings, error: mappingsError } = await supabase
      .from('jumia_product_mappings')
      .select(
        'id, product_id, variant_id, jumia_seller_sku, jumia_product_id, baci_stock_at_last_sync'
      )
      .eq('merchant_id', merchantId)
      .eq('jumia_shop_id', jumiaClient.shopId)
      .eq('marketplace_key', jumiaClient.marketplaceKey)
      .eq('sync_status', 'synced');

    if (mappingsError) {
      console.error(
        '[Jumia Stock Sync] Failed to fetch mappings:',
        mappingsError
      );
      return NextResponse.json(
        { error: 'Failed to fetch product mappings' },
        { status: 500 }
      );
    }

    if (!mappings || mappings.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        skipped: 0,
        message: 'No synced product mappings found',
      });
    }

    // Filter to push-ready mappings (must have seller SKU and product ID)
    const pushReady: ProductMapping[] = [];
    let skipped = 0;

    for (const m of mappings) {
      if (!m.jumia_seller_sku?.trim() || !m.jumia_product_id?.trim()) {
        skipped++;
        continue;
      }
      pushReady.push(m as ProductMapping);
    }

    if (pushReady.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        skipped,
        message: 'No push-ready mappings (missing seller SKU or product ID)',
      });
    }

    // Batch-resolve stock: collect IDs and query in bulk
    const variantIds = Array.from(
      new Set(
        pushReady.flatMap((mapping) =>
          mapping.variant_id ? [mapping.variant_id] : []
        )
      )
    );
    const productOnlyIds = Array.from(
      new Set(pushReady.filter((m) => !m.variant_id).map((m) => m.product_id))
    );

    const variantStockMap = new Map<string, number>();
    const productStockMap = new Map<string, number>();
    let fetchErrors = 0;

    // Fetch variant stock in batch
    if (variantIds.length > 0) {
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, stock_quantity')
        .in('id', variantIds);

      if (variantsError) {
        fetchErrors++;
        console.error(
          '[Jumia Stock Sync] Failed to fetch variant stock:',
          variantsError
        );
      }
      for (const v of variants || []) {
        variantStockMap.set(
          v.id,
          Math.max(0, Math.trunc(Number(v.stock_quantity) || 0))
        );
      }
    }

    // Fetch product stock in batch
    if (productOnlyIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, stock, stock_quantity')
        .in('id', productOnlyIds);

      if (productsError) {
        fetchErrors++;
        console.error(
          '[Jumia Stock Sync] Failed to fetch product stock:',
          productsError
        );
      }
      for (const p of products || []) {
        productStockMap.set(p.id, getEffectiveStock(p));
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

      // Only push if stock has actually changed
      if (stock === mapping.baci_stock_at_last_sync) {
        continue;
      }

      if (!mapping.jumia_seller_sku || !mapping.jumia_product_id) {
        skipped++;
        continue;
      }

      stockUpdates.push({
        mappingId: mapping.id,
        sellerSku: mapping.jumia_seller_sku,
        id: mapping.jumia_product_id,
        stock,
      });
    }

    if (stockUpdates.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        skipped,
        message: 'All stock levels are up to date',
      });
    }

    // Push stock to Jumia
    const feedId = await updateStock(
      jumiaClient,
      stockUpdates.map(({ sellerSku, id, stock }) => ({
        sellerSku,
        id,
        stock,
      }))
    );

    // Update tracking columns on all pushed mappings (batched upsert)
    const now = new Date().toISOString();
    let trackingFailures = 0;

    const bulkUpdates = stockUpdates.map((update) => ({
      id: update.mappingId,
      baci_stock_at_last_sync: update.stock,
      last_stock_synced_at: now,
      last_feed_id: feedId,
    }));

    const { error: bulkError } = await supabase
      .from('jumia_product_mappings')
      .upsert(bulkUpdates, { onConflict: 'id', ignoreDuplicates: false });

    if (bulkError) {
      trackingFailures = stockUpdates.length;
      console.error(
        '[Jumia Stock Sync] Bulk tracking update failed:',
        bulkError
      );
    }

    return NextResponse.json({
      success: true,
      updated: stockUpdates.length,
      skipped,
      feedId,
      ...(trackingFailures > 0 && { trackingFailures }),
      ...(fetchErrors > 0 && { fetchErrors: fetchErrors }),
      message: `Pushed ${stockUpdates.length} stock updates to Jumia`,
    });
  } catch (error) {
    if (error instanceof JumiaApiError) {
      return jumiaErrorResponse(error);
    }
    console.error('[Jumia Stock Sync] Error:', error);
    return NextResponse.json({ error: 'Stock sync failed' }, { status: 500 });
  }
}
