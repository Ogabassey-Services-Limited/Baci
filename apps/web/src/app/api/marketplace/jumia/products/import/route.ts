import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';

const ImportSchema = z.object({
  integrationId: z.string().uuid(),
  merchantId: z.string().uuid().optional(),
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

    // Verify integrationId belongs to this merchant
    const { data: integration, error: integrationError } = await auth.supabase
      .from('marketplace_integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 403 }
      );
    }

    // 1. Initialize Clients
    const supabase = auth.supabase;
    const jumia = await JumiaClient.fromIntegration(integrationId, {
      supabase,
      merchantId,
    });

    // 2. Fetch all products from Jumia
    // Default to Active products, but could be configurable
    const jumiaProducts = await jumia.getProducts({ status: 'Active' });

    if (!jumiaProducts.length) {
      return NextResponse.json({
        success: true,
        summary: { total: 0, created: 0, linked: 0, updated: 0, errors: 0 },
      });
    }

    let created = 0;
    let linked = 0;
    let errors = 0;
    const updated = 0;

    const skus = jumiaProducts
      .map((jp) => jp.SellerSku)
      .filter((sku): sku is string => Boolean(sku));

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
      });
    }

    const { data: existingProductsData } = await supabase
      .from('products')
      .select('id, sku')
      .eq('merchant_id', merchantId)
      .in('sku', skus);

    const existingProducts = existingProductsData || [];
    const productBySku = new Map(
      existingProducts.filter((p) => p.sku).map((p) => [p.sku, p])
    );
    const existingProductIds = new Set(existingProducts.map((p) => p.id));

    const { data: existingMappingsData } = await supabase
      .from('jumia_product_mappings')
      .select('id, jumia_sku')
      .eq('merchant_id', merchantId)
      .in('jumia_sku', skus);

    const mappedSkus = new Set(
      (existingMappingsData || [])
        .filter((m) => m.jumia_sku)
        .map((m) => m.jumia_sku)
    );

    // 3. Process each product
    const mappingRows: MappingRow[] = [];
    const newProductRows: ProductRow[] = [];
    const pendingNewProductMappings = new Map<
      string,
      Omit<MappingRow, 'product_id'>
    >();

    for (const jp of jumiaProducts) {
      const sku = jp.SellerSku;
      if (!sku) continue;

      const product = productBySku.get(sku);
      const productId = product?.id;
      const price = Number.parseFloat(jp.Price?.toString() || '0');
      const isActive = jp.Status === 'Active';
      const mappingBase = {
        merchant_id: merchantId,
        jumia_sku: sku,
        jumia_seller_sku: sku,
        jumia_shop_id: jumia.getShopId(),
        jumia_price: price,
        jumia_product_id: null,
        is_active: isActive,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      };

      if (productId) {
        // LINK EXISTING
        if (!mappedSkus.has(sku)) {
          mappingRows.push({ ...mappingBase, product_id: productId });
        }
      } else {
        // CREATE NEW PRODUCT
        newProductRows.push({
          merchant_id: merchantId,
          name: jp.Name || 'Imported Jumia Product',
          description: jp.Description || '',
          price,
          sku,
          stock_level: Number.parseInt(
            String(jp.ProductData?.Quantity || '0'),
            10
          ),
          is_active: isActive,
          images: jp.Images || (jp.MainImage ? [jp.MainImage] : []),
        });
        pendingNewProductMappings.set(sku, mappingBase);
      }
    }

    let insertedProducts: { id: string; sku: string }[] = [];
    if (newProductRows.length) {
      const { data: newProductsData, error: insertError } = await supabase
        .from('products')
        .insert(newProductRows)
        .select('id, sku');

      if (insertError || !newProductsData) {
        logger.error({
          message: 'Product bulk insert failed',
          error: insertError,
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

    if (mappingRows.length) {
      const { error: mappingInsertError } = await supabase
        .from('jumia_product_mappings')
        .insert(mappingRows);

      if (mappingInsertError) {
        logger.error({
          message: 'Mapping bulk insert failed',
          error: mappingInsertError,
        });
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
        total: jumiaProducts.length,
        created,
        linked,
        updated,
        errors,
      },
    });
  } catch (error) {
    logger.error({ message: 'Import error', error });
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
