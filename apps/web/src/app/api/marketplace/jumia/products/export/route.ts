import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { JumiaClient } from '@/lib/jumia/client';
import { createProduct } from '@/lib/jumia/feeds';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { logger } from '@/lib/logger';
import {
  getMerchantFeatureAccess,
  merchantFeatureUpgradeResponse,
} from '@/lib/merchant-feature-gates';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize-core';

const VariationSchema = z.object({
  sellerSku: z.string().trim().min(1),
  price: z.number().positive(),
  currency: z.string().default('NGN'),
  stock: z.int().min(0).optional(),
  attributes: z
    .array(z.object({ id: z.string(), value: z.string() }))
    .optional(),
});

const ExportSchema = z.object({
  integrationId: z.uuid(),
  merchantId: z.uuid().optional(),
  name: z.string().trim().min(1),
  brand: z.object({ code: z.number(), name: z.string() }),
  category: z.object({ code: z.number() }),
  description: z.string().optional(),
  images: z
    .array(z.object({ url: z.url(), primary: z.boolean().optional() }))
    .optional(),
  variations: z.array(VariationSchema).min(1),
});

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

    const parsed = ExportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const {
      integrationId,
      merchantId: requestedMerchantId,
      name,
      brand,
      category,
      description,
      images,
      variations,
    } = parsed.data;

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

    const supabase = auth.supabase;
    const featureAccess = await getMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (!featureAccess.allowed) {
      return merchantFeatureUpgradeResponse('marketplace_sync');
    }

    let jumia: JumiaClient;
    try {
      jumia = await JumiaClient.forIntegration(
        supabase,
        merchantId,
        integrationId
      );
    } catch (clientError) {
      if (clientError instanceof JumiaApiError) {
        logger.error({
          message: 'Jumia integration error',
          error: clientError,
          status: clientError.status,
        });
        return NextResponse.json(
          { error: clientError.message },
          { status: clientError.status }
        );
      }
      logger.error({
        message: 'Jumia integration initialization failed',
        error: clientError,
      });
      const errorMessage = String(
        clientError instanceof Error ? clientError.message : clientError
      );
      const isExpired =
        errorMessage.toLowerCase().includes('expired') ||
        errorMessage.toLowerCase().includes('unauthorized');
      const isNotFound = errorMessage.toLowerCase().includes('not found');
      return NextResponse.json(
        {
          error: isExpired
            ? 'Jumia credentials expired — please reconnect'
            : isNotFound
              ? 'Jumia integration not found'
              : 'Jumia integration initialization failed',
        },
        { status: isExpired ? 401 : isNotFound ? 404 : 502 }
      );
    }

    // Build Vendor Center product body — sanitize merchant-supplied text
    const safeName = sanitizeText(stripHtmlTags(name)) || '[Untitled]';
    const safeDescription = description
      ? sanitizeText(stripHtmlTags(description))?.trim() || undefined
      : undefined;

    let feedId: string;
    try {
      feedId = await createProduct(jumia, jumia.shopId, [
        {
          name: { value: safeName },
          brand,
          category,
          description: safeDescription ? { value: safeDescription } : undefined,
          images,
          variations: variations.map((v) => ({
            sellerSku: v.sellerSku,
            globalPrice: { value: v.price, currency: v.currency },
            stock: v.stock,
            attributes: v.attributes,
          })),
        },
      ]);
    } catch (feedError) {
      if (feedError instanceof JumiaApiError) {
        logger.error({
          message: 'Jumia createProduct feed failed',
          error: feedError,
          status: feedError.status,
        });
        return NextResponse.json(
          { error: `Jumia product export failed: ${feedError.message}` },
          { status: feedError.status }
        );
      }
      throw feedError;
    }

    // Create pending mapping for the first variation SKU (link to Baci product if exists)
    const primarySku = variations[0].sellerSku;
    const { data: existingProduct, error: lookupError } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('sku', primarySku)
      .maybeSingle();

    if (lookupError) {
      logger.error({
        message: 'Product lookup by SKU failed',
        error: lookupError,
        sku: primarySku,
      });
    }

    if (existingProduct) {
      const { error: upsertError } = await supabase
        .from('jumia_product_mappings')
        .upsert(
          {
            merchant_id: merchantId,
            product_id: existingProduct.id,
            // jumia_sku uses sellerSku as placeholder until Jumia assigns the
            // canonical SKU via the feed callback.
            jumia_sku: primarySku,
            jumia_seller_sku: primarySku,
            jumia_shop_id: jumia.shopId,
            jumia_price: variations[0].price,
            sync_status: 'pending',
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'merchant_id,jumia_sku' }
        );
      if (upsertError) {
        logger.error({ message: 'Mapping upsert failed', error: upsertError });
        return NextResponse.json(
          {
            success: false,
            partial: true,
            feedId,
            message:
              'Product export initiated but local mapping failed to save.',
          },
          { status: 207 }
        );
      }
    }

    const mappingLinked = !!existingProduct;

    return NextResponse.json({
      success: true,
      feedId,
      message:
        'Product export initiated. Check Jumia Vendor Center for status.',
      ...(mappingLinked && {
        note: `Product mapping upserted for SKU "${primarySku}". If a mapping already existed it was overwritten.`,
      }),
      ...(!mappingLinked && !lookupError && { mappingSkipped: true }),
      ...(lookupError && { lookupFailed: true }),
    });
  } catch (error) {
    logger.error({ message: 'Export error', error });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
