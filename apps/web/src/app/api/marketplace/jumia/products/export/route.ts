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
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import {
  finalizeJumiaExportReservation,
  markJumiaExportReservationUnrecoverable,
  releaseJumiaExportReservation,
  reserveJumiaExportMappings,
} from './export-product-reservation';
import {
  loadJumiaMarketplaceCurrency,
  resolveAuthorizedExportProduct,
} from './export-product-source';

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
  productId: z.uuid(),
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
    const auth = await authenticateApiRequest(req);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(req);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
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
      productId,
      brand,
      category,
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
    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    const currencyResult = await loadJumiaMarketplaceCurrency(
      supabase,
      merchantId,
      integrationId
    );
    if (!currencyResult.ok) {
      return NextResponse.json(
        { error: currencyResult.error },
        { status: currencyResult.status }
      );
    }

    const resolved = await resolveAuthorizedExportProduct(
      supabase,
      merchantId,
      productId,
      currencyResult.currency
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status }
      );
    }

    const {
      name: exportName,
      description: exportDescription,
      images: exportImages,
      variations: exportVariations,
      productId: linkedProductId,
      variantIdsBySku,
    } = resolved.product;

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

    const reservation = await reserveJumiaExportMappings({
      supabase,
      merchantId,
      productId: linkedProductId ?? productId,
      shopId: jumia.shopId,
      marketplaceKey: jumia.marketplaceKey,
      exportVariations,
      linkedProductId,
      variantIdsBySku,
    });
    if (!reservation.ok) {
      return NextResponse.json(
        { error: reservation.error, code: reservation.code },
        { status: reservation.status }
      );
    }

    let feedId: string;
    try {
      feedId = await createProduct(jumia, jumia.shopId, [
        {
          name: { value: exportName },
          brand,
          category,
          description: exportDescription
            ? { value: exportDescription }
            : undefined,
          images: exportImages,
          variations: exportVariations.map((variation) => ({
            sellerSku: variation.sellerSku,
            globalPrice: {
              value: variation.price,
              currency: variation.currency,
            },
            stock: variation.stock,
            attributes: variation.attributes,
          })),
        },
      ]);
    } catch (feedError) {
      await releaseJumiaExportReservation(supabase, {
        merchantId,
        productId: reservation.productId,
        shopId: jumia.shopId,
        marketplaceKey: jumia.marketplaceKey,
        exportVariations,
      });
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

    const finalized = await finalizeJumiaExportReservation(supabase, {
      merchantId,
      productId: reservation.productId,
      shopId: jumia.shopId,
      marketplaceKey: jumia.marketplaceKey,
      feedId,
      exportVariations,
    });

    if (!finalized) {
      logger.error({
        message: 'Jumia export mapping finalize failed',
        feed_id: feedId,
      });
      await markJumiaExportReservationUnrecoverable(supabase, {
        merchantId,
        productId: reservation.productId,
        shopId: jumia.shopId,
        marketplaceKey: jumia.marketplaceKey,
        feedId,
        exportVariations,
      });
      return NextResponse.json(
        {
          success: false,
          partial: true,
          feedId,
          error:
            'Product export initiated but local mapping failed to save feed ID. Retry the export to recover.',
        },
        { status: 207 }
      );
    }

    const primarySku = exportVariations[0]?.sellerSku ?? '';

    return NextResponse.json({
      success: true,
      feedId,
      message:
        'Product export initiated. Check Jumia Vendor Center for status.',
      note: `Product mapping reserved for SKU "${primarySku}".`,
    });
  } catch (error) {
    logger.error({ message: 'Export error', error });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
