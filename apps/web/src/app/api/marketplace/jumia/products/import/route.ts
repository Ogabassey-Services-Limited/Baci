import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getAllProducts } from '@/lib/jumia/catalog';
import { JumiaApiError, JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize-core';

const ImportSchema = z.object({
  integrationId: z.uuid(),
  merchantId: z.uuid().optional(),
});

type MappingRow = {
  merchant_id: string;
  product_id: string;
  jumia_sku: string;
  jumia_seller_sku: string;
  jumia_shop_id: string;
  jumia_price: number;
  jumia_product_id: string | null;
  is_active: boolean;
  sync_status: string;
  last_synced_at: string;
};

type ProductRow = {
  merchant_id: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  stock_level: number;
  is_active: boolean;
  images: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(req);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(req);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = ImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { integrationId, merchantId: requestedMerchantId } = parsed.data;

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (requestedMerchantId && requestedMerchantId !== merchantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const featureGateResponse = await requireMerchantFeatureAccess(
      auth.supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    // 1. Initialize Clients
    const supabase = auth.supabase;
    let jumia: Awaited<ReturnType<typeof JumiaClient.forIntegration>>;
    try {
      jumia = await JumiaClient.forIntegration(
        supabase,
        merchantId,
        integrationId
      );
    } catch (err) {
      if (err instanceof JumiaApiError) {
        if (err.status === 404) {
          return NextResponse.json(
            { error: 'Integration not found' },
            { status: 404 }
          );
        }
        if (err.status === 403 || err.status === 401) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({
        message: 'Failed to initialize Jumia client',
        error: message,
      });
      return NextResponse.json(
        { error: 'Failed to initialize Jumia client' },
        { status: 500 }
      );
    }

    // 2. Fetch all products from Jumia (auto-paginating)
    let jumiaProducts: Awaited<ReturnType<typeof getAllProducts>>;
    try {
      const productQuery = {
        status: 'active' as const,
        ...(jumia.shopId === 'oauth' ? {} : { shopId: jumia.shopId }),
      };
      jumiaProducts = await getAllProducts(jumia, {
        ...productQuery,
      });
    } catch (fetchErr) {
      const message =
        fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
      logger.error({
        message: 'Failed to fetch products from Jumia',
        error: message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch products from Jumia' },
        { status: 502 }
      );
    }

    if (!jumiaProducts.length) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, created: 0, linked: 0, updated: 0, errors: 0 },
      });
    }

    let created = 0;
    let linked = 0;
    let errors = 0;
    let skippedNoSkuCount = 0;
    let missingPriceCount = 0;
    const warningMessages: string[] = [];
    // TODO: Implement update-on-reimport to populate this counter
    const updated = 0;

    // Flatten parent products into per-variation entries
    // Each variation has its own sellerSku and price
    const flatEntries: Array<{
      sku: string;
      name: string;
      description: string;
      price: number;
      images: string[];
      productId: string;
    }> = [];

    for (const jp of jumiaProducts) {
      for (const variation of jp.variations) {
        if (!variation.sellerSku) {
          skippedNoSkuCount++;
          continue;
        }
        if (variation.globalPrice?.value == null) {
          missingPriceCount++;
          continue;
        }
        const price = variation.globalPrice.value;
        flatEntries.push({
          sku: variation.sellerSku,
          name: jp.name,
          description: jp.description,
          price,
          images: (jp.images ?? [])
            .map((img) => img?.url)
            .filter((v): v is string => typeof v === 'string' && v.length > 0),
          productId: jp.id,
        });
      }
    }

    const skus = flatEntries.map((e) => e.sku);

    if (!skus.length) {
      return NextResponse.json({
        success: true,
        summary: {
          total: jumiaProducts.length,
          created: 0,
          linked: 0,
          updated: 0,
          errors: 0,
        },
        warnings: {
          skippedNoSku: skippedNoSkuCount,
          missingPrice: missingPriceCount,
        },
      });
    }

    const { data: existingProductsData, error: productsQueryError } =
      await supabase
        .from('products')
        .select('id, sku')
        .eq('merchant_id', merchantId)
        .in('sku', skus);

    if (productsQueryError) {
      logger.error({
        message: 'Failed to query existing products',
        error: productsQueryError,
      });
      return NextResponse.json(
        { error: 'Failed to query existing products' },
        { status: 500 }
      );
    }

    const existingProducts = existingProductsData || [];
    const productBySku = new Map(
      existingProducts.filter((p) => p.sku).map((p) => [p.sku, p])
    );
    const existingProductIds = new Set(existingProducts.map((p) => p.id));

    const { data: existingMappingsData, error: mappingsQueryError } =
      await supabase
        .from('jumia_product_mappings')
        .select('id, jumia_sku')
        .eq('merchant_id', merchantId)
        .eq('jumia_shop_id', jumia.shopId)
        .eq('marketplace_key', jumia.marketplaceKey)
        .in('jumia_sku', skus);

    if (mappingsQueryError) {
      logger.error({
        message: 'Failed to query existing mappings',
        error: mappingsQueryError,
      });
      return NextResponse.json(
        { error: 'Failed to query existing mappings' },
        { status: 500 }
      );
    }

    const mappedSkus = new Set(
      (existingMappingsData || [])
        .filter((m) => m.jumia_sku)
        .map((m) => m.jumia_sku)
    );

    // 3. Process each variation
    const mappingRows: MappingRow[] = [];
    const newProductRows: ProductRow[] = [];
    const pendingNewProductMappings = new Map<
      string,
      Omit<MappingRow, 'product_id'>
    >();

    for (const entry of flatEntries) {
      const { sku } = entry;

      const product = productBySku.get(sku);
      const localProductId = product?.id;
      const mappingBase = {
        merchant_id: merchantId,
        jumia_sku: sku,
        jumia_seller_sku: sku,
        jumia_shop_id: jumia.shopId,
        marketplace_key: jumia.marketplaceKey,
        jumia_price: entry.price,
        jumia_product_id: entry.productId,
        is_active: true,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      };

      if (localProductId) {
        // LINK EXISTING
        if (!mappedSkus.has(sku)) {
          mappingRows.push({ ...mappingBase, product_id: localProductId });
        }
      } else {
        // CREATE NEW PRODUCT
        newProductRows.push({
          merchant_id: merchantId,
          name:
            sanitizeText(stripHtmlTags(entry.name)) || 'Imported Jumia Product',
          description: sanitizeText(stripHtmlTags(entry.description)) || '',
          price: entry.price,
          sku,
          // Jumia product listing doesn't include stock; merchant sets stock after import
          stock_level: 0,
          is_active: false,
          images: entry.images,
        });
        pendingNewProductMappings.set(sku, mappingBase);
      }
    }

    // Upsert products (idempotent on SKU conflicts from repeated imports)
    let insertedProducts: { id: string; sku: string }[] = [];
    if (newProductRows.length) {
      const { data: newProductsData, error: upsertError } = await supabase
        .from('products')
        .upsert(newProductRows, { onConflict: 'merchant_id,sku' })
        .select('id, sku');

      if (upsertError || !newProductsData) {
        logger.error({
          message: 'Product bulk upsert failed',
          error: upsertError,
        });
        errors += newProductRows.length;
      } else {
        insertedProducts = newProductsData;
      }
    }

    for (const product of insertedProducts) {
      const mappingBase = pendingNewProductMappings.get(product.sku);
      if (mappingBase) {
        mappingRows.push({ ...mappingBase, product_id: product.id });
      }
    }

    // Upsert mappings (idempotent on repeated imports)
    if (mappingRows.length) {
      const { error: mappingUpsertError } = await supabase
        .from('jumia_product_mappings')
        .upsert(mappingRows, {
          onConflict: 'merchant_id,jumia_sku',
        });

      if (mappingUpsertError) {
        logger.error({
          message: 'Mapping bulk upsert failed',
          error: mappingUpsertError,
        });
        // Partial failure: products created but mappings failed
        if (insertedProducts.length > 0) {
          const msg = `${insertedProducts.length} products created but mapping upsert failed; re-run to link`;
          warningMessages.push(msg);
          logger.warn({ message: msg, error: mappingUpsertError });
          // Count products as created even though mappings failed
          created += insertedProducts.length;
        }
        errors += mappingRows.length;
      } else {
        const newProductIds = new Set(insertedProducts.map((p) => p.id));
        for (const row of mappingRows) {
          if (existingProductIds.has(row.product_id)) {
            linked += 1;
          } else if (newProductIds.has(row.product_id)) {
            created += 1;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: flatEntries.length,
        created,
        linked,
        updated,
        errors,
      },
      warnings: {
        skippedNoSku: skippedNoSkuCount,
        missingPrice: missingPriceCount,
      },
      ...(warningMessages.length > 0 && { warningMessages }),
    });
  } catch (error) {
    logger.error({ message: 'Import error', error });
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
