import type { SupabaseClient } from '@supabase/supabase-js';
import type { JumiaClient } from '@/lib/jumia/client';
import { createProduct } from '@/lib/jumia/feeds';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { logger } from '@/lib/logger';
import {
  finalizeJumiaExportReservation,
  markJumiaExportReservationForReconciliation,
  releaseJumiaExportReservation,
} from './export-product-reservation';
import type { ExportVariation } from './export-product-source';

export async function submitJumiaExportFeed(args: {
  jumia: JumiaClient;
  supabase: SupabaseClient;
  merchantId: string;
  productId: string;
  shopId: string;
  marketplaceKey: string;
  exportName: string;
  exportDescription?: string;
  exportImages?: Array<{ url: string; primary?: boolean }>;
  brand: { code: number; name: string };
  category: { code: number };
  exportVariations: ExportVariation[];
}): Promise<
  | { ok: true; feedId: string }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const {
    jumia,
    supabase,
    merchantId,
    productId,
    shopId,
    marketplaceKey,
    exportVariations,
  } = args;

  let feedId: string;
  try {
    feedId = await createProduct(jumia, shopId, [
      {
        name: { value: args.exportName },
        brand: args.brand,
        category: args.category,
        description: args.exportDescription
          ? { value: args.exportDescription }
          : undefined,
        images: args.exportImages,
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
    const released = await releaseJumiaExportReservation(supabase, {
      merchantId,
      productId,
      shopId,
      marketplaceKey,
      exportVariations,
    });
    if (!released) {
      logger.error({
        message:
          'Failed to release Jumia export reservation after createProduct failure',
        merchant_id: merchantId,
        product_id: productId,
      });
    }
    if (feedError instanceof JumiaApiError) {
      logger.error({
        message: 'Jumia createProduct feed failed',
        error: feedError,
        status: feedError.status,
      });
      return {
        ok: false,
        status: feedError.status,
        body: { error: `Jumia product export failed: ${feedError.message}` },
      };
    }
    throw feedError;
  }

  const finalized = await finalizeJumiaExportReservation(supabase, {
    merchantId,
    productId,
    shopId,
    marketplaceKey,
    feedId,
    exportVariations,
  });

  if (!finalized) {
    logger.error({
      message: 'Jumia export mapping finalize failed',
      feed_id: feedId,
    });
    const reconciliationRecorded =
      await markJumiaExportReservationForReconciliation(supabase, {
        merchantId,
        productId,
        shopId,
        marketplaceKey,
        feedId,
        exportVariations,
      });
    return {
      ok: false,
      status: 207,
      body: {
        success: false,
        partial: true,
        feedId,
        error: reconciliationRecorded
          ? 'Product export initiated but local mapping failed to save feed ID. Feed-status reconciliation will recover the accepted feed.'
          : 'Product export initiated, but automatic reconciliation could not be recorded. Contact support and provide the feed ID.',
      },
    };
  }

  return { ok: true, feedId };
}
