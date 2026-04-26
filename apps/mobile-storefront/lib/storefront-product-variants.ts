import { withSupabaseRetry } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const log = createLogger('StorefrontProductVariants');

export interface StorefrontProductVariantRow {
  attributes?: Record<string, string> | null;
  condition?: string | null;
  created_at?: string | null;
  id: string;
  images?: unknown;
  price_override?: number | string | null;
  primary_image?: string | null;
  product_id: string;
  sku?: string | null;
  stock_quantity?: number | null;
  updated_at?: string | null;
}

interface ProductRowWithId {
  id?: unknown;
  variants?: unknown;
}

export async function getStorefrontProductVariantsByProductIds(
  productIds: string[]
) {
  const uniqueProductIds = Array.from(
    new Set(productIds.filter((id): id is string => Boolean(id)))
  );

  if (uniqueProductIds.length === 0) {
    return {} as Record<string, StorefrontProductVariantRow[]>;
  }

  const { data, error } = await withSupabaseRetry(
    async () =>
      await supabase.rpc('get_storefront_product_variants', {
        p_product_ids: uniqueProductIds,
      }),
    {
      maxRetries: 3,
      onRetry: (attempt, err) => {
        log.warn(`Variant rpc retry ${attempt}: ${err.message}`);
      },
    }
  );

  if (error) {
    log.error('Failed to fetch storefront product variants', {
      error,
      productIds: uniqueProductIds,
    });
    return {} as Record<string, StorefrontProductVariantRow[]>;
  }

  const variantsByProductId: Record<string, StorefrontProductVariantRow[]> = {};

  for (const variant of (data ?? []) as StorefrontProductVariantRow[]) {
    if (!variantsByProductId[variant.product_id]) {
      variantsByProductId[variant.product_id] = [];
    }

    variantsByProductId[variant.product_id].push(variant);
  }

  return variantsByProductId;
}

export async function hydrateProductRowsWithStorefrontVariants<
  TRow extends ProductRowWithId,
>(rows: TRow[]) {
  const variantsByProductId = await getStorefrontProductVariantsByProductIds(
    rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string')
  );

  return rows.map((row) => {
    if (typeof row.id !== 'string') {
      return row;
    }

    const hydratedVariants = variantsByProductId[row.id];
    if (!hydratedVariants || hydratedVariants.length === 0) {
      return row;
    }

    return {
      ...row,
      variants: hydratedVariants,
    };
  });
}
