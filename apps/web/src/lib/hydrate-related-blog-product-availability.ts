import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveStock } from '@/lib/product-stock';
import type { RelatedBlogProduct } from '@/lib/related-blog-products';
import { isValidUuid } from '@/lib/sanitize-core';

interface OfferStockRow {
  stock_quantity?: number | string | null;
}

interface VariantStockRow {
  product_id?: string | null;
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

function isVariantStockRow(value: unknown): value is VariantStockRow {
  return typeof value === 'object' && value !== null;
}

function hasStockedVariant(data: unknown, productId: string): boolean {
  return (
    Array.isArray(data) &&
    data.some(
      (variant) =>
        isVariantStockRow(variant) &&
        variant.product_id === productId &&
        getEffectiveStock(variant) > 0
    )
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
  const variantCandidates = products.filter(
    (product) =>
      product.has_variants === true &&
      product.manage_stock === true &&
      getEffectiveStock(product) <= 0 &&
      isValidUuid(product.id)
  );

  if (candidates.length === 0 && variantCandidates.length === 0) {
    return [...products];
  }

  const [offerAvailability, variantAvailability] = await Promise.all([
    Promise.all(
      candidates.map(async (product) => {
        try {
          const { data, error } = await supabase.rpc('get_product_offers', {
            p_product_id: product.id,
          });

          if (error) {
            console.warn(
              'Related blog product offer availability unavailable',
              {
                productId: product.id,
                error,
              }
            );
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
    ),
    variantCandidates.length > 0
      ? (async () => {
          try {
            const { data, error } = await supabase.rpc(
              'get_storefront_product_variants',
              {
                p_product_ids: variantCandidates.map((product) => product.id),
              }
            );

            if (error) {
              console.warn(
                'Related blog product variant availability unavailable',
                {
                  productIds: variantCandidates.map((product) => product.id),
                  error,
                }
              );
              return variantCandidates.map(
                (product) => [product.id, undefined] as const
              );
            }

            return variantCandidates.map(
              (product) =>
                [product.id, hasStockedVariant(data, product.id)] as const
            );
          } catch (error) {
            console.warn(
              'Related blog product variant availability unavailable',
              {
                productIds: variantCandidates.map((product) => product.id),
                error,
              }
            );
            return variantCandidates.map(
              (product) => [product.id, undefined] as const
            );
          }
        })()
      : Promise.resolve([] as Array<readonly [string, boolean | undefined]>),
  ]);

  const offerAvailabilityById = new Map(offerAvailability);
  const variantAvailabilityById = new Map(variantAvailability);
  return products.map((product) => {
    const offerAvailable = offerAvailabilityById.get(product.id);
    const variantAvailable = variantAvailabilityById.get(product.id);
    return {
      ...product,
      ...(offerAvailable !== undefined
        ? { has_purchasable_condition_offer: offerAvailable }
        : {}),
      ...(variantAvailable !== undefined
        ? { has_purchasable_variant: variantAvailable }
        : {}),
    };
  });
}
