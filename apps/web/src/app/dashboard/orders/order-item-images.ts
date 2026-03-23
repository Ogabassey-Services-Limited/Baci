import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface ProductImageRecord {
  id: string;
  images: unknown;
}

export function extractOrderItemImage(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const firstImage = images[0];

  if (typeof firstImage === 'string') {
    return firstImage || undefined;
  }

  if (
    firstImage &&
    typeof firstImage === 'object' &&
    'url' in firstImage &&
    typeof firstImage.url === 'string'
  ) {
    return firstImage.url || undefined;
  }

  return undefined;
}

export async function loadOrderItemImageMap(
  supabase: SupabaseClient,
  productIds: Array<string | null | undefined>
) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))] as string[];

  if (uniqueProductIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, images')
    .in('id', uniqueProductIds);

  if (error) {
    logger.error({
      message: 'Failed to load dashboard order item images',
      error,
      productIds: uniqueProductIds,
      route: 'dashboard/orders/loadOrderItemImageMap',
    });
    return new Map<string, string>();
  }

  return new Map(
    ((data || []) as ProductImageRecord[])
      .map((product) => [product.id, extractOrderItemImage(product.images)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}
