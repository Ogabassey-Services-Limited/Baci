import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveStock } from '@/lib/product-stock';
import type { RelatedBlogProduct } from '@/lib/related-blog-products';

interface OfferStockRow {
  stock_quantity?: number | string | null;
}

function isOfferStockRow(value: unknown): value is OfferStockRow {
  return typeof value === 'object' && value !== null;
}

function hasStockedOffer(data: unknown): boolean {
  return (
    Array.isArray(data) &&
    data.some((offer) => isOfferStockRow(offer) && getEffectiveStock(offer) > 0)
  );
}

/**
 * Resolve alternate-condition availability for related blog products whose
 * primary stock is empty. `product_offers` is intentionally staff-only, so
 * the public `get_product_offers` SECURITY DEFINER RPC is the supported read
 * path for this small, bounded rail. Errors stay fail-open: an unknown offer
 * state must not claim a product is unavailable when the PDP may still have a
 * purchasable condition.
 */
export async function hydrateRelatedBlogProductAvailability(
  supabase: Pick<SupabaseClient, 'rpc'>,
  products: readonly RelatedBlogProduct[]
): Promise<RelatedBlogProduct[]> {
  const candidates = products.filter(
    (product) =>
      product.has_condition_offers === true &&
      product.manage_stock === true &&
      getEffectiveStock(product) <= 0
  );

  if (candidates.length === 0) {
    return [...products];
  }

  const availability = await Promise.all(
    candidates.map(async (product) => {
      try {
        const { data, error } = await supabase.rpc('get_product_offers', {
          p_product_id: product.id,
        });

        if (error) {
          console.warn('Related blog product offer availability unavailable', {
            productId: product.id,
            error,
          });
          return [product.id, undefined] as const;
        }

        return [product.id, hasStockedOffer(data)] as const;
      } catch (error) {
        console.warn('Related blog product offer availability unavailable', {
          productId: product.id,
          error,
        });
        return [product.id, undefined] as const;
      }
    })
  );

  const availabilityById = new Map(availability);
  return products.map((product) => {
    const offerAvailability = availabilityById.get(product.id);
    return offerAvailability === undefined
      ? product
      : {
          ...product,
          has_purchasable_condition_offer: offerAvailability,
        };
  });
}
