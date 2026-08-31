import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveStock } from '@/lib/product-stock';
import type {
  RelatedBlogProduct,
  RelatedBlogProductOffer,
  RelatedBlogProductVariant,
} from '@/lib/related-blog-products';
import { isValidUuid } from '@/lib/sanitize-core';

interface OfferStockRow {
  compare_at_price?: number | string | null;
  price?: number | string | null;
  status?: string | null;
  stock_quantity?: number | string | null;
}

interface VariantStockRow {
  price_override?: number | string | null;
  product_id?: string | null;
  stock_quantity?: number | string | null;
}

interface AvailabilityResolution {
  available?: boolean;
  offers?: RelatedBlogProductOffer[];
  variants?: RelatedBlogProductVariant[];
}

type AvailabilityPair = readonly [string, AvailabilityResolution | undefined];

function toFinitePrice(value: unknown): number | null {
  const price =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : null;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0
    ? price
    : null;
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

function normalizeOfferRows(data: unknown): RelatedBlogProductOffer[] {
  if (!Array.isArray(data)) return [];

  return data.flatMap((offer) => {
    if (!isOfferStockRow(offer)) return [];
    const price = toFinitePrice(offer.price);
    const compareAtPrice = toFinitePrice(offer.compare_at_price);
    return [
      {
        ...(price !== null ? { price } : {}),
        ...(compareAtPrice !== null
          ? { compare_at_price: compareAtPrice }
          : {}),
        status: offer.status ?? 'active',
        stock_quantity: toFinitePrice(offer.stock_quantity),
      },
    ];
  });
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

function normalizeVariantRows(
  data: unknown,
  product: RelatedBlogProduct
): RelatedBlogProductVariant[] {
  if (!Array.isArray(data)) return [];

  return data.flatMap((variant) => {
    if (!isVariantStockRow(variant) || variant.product_id !== product.id) {
      return [];
    }
    const priceOverride = toFinitePrice(variant.price_override);
    const parentPrice = toFinitePrice(product.price);
    return [
      {
        ...(priceOverride !== null
          ? { price_override: priceOverride }
          : parentPrice !== null
            ? { price_override: parentPrice }
            : {}),
        stock_quantity: toFinitePrice(variant.stock_quantity),
      },
    ];
  });
}

/**
 * Resolve alternate-condition and SKU-variant availability and prices for
 * related blog products. The public SECURITY DEFINER RPCs are the supported
 * read path for this small, bounded rail. Errors stay fail-open: an unknown
 * alternate state must not claim a product is unavailable.
 */
export async function hydrateRelatedBlogProductAvailability(
  supabase: Pick<SupabaseClient, 'rpc'>,
  products: readonly RelatedBlogProduct[]
): Promise<RelatedBlogProduct[]> {
  const offerCandidates = products.filter(
    (product) => product.has_condition_offers === true
  );
  const variantCandidates = products.filter(
    (product) => product.has_variants === true && isValidUuid(product.id)
  );

  if (offerCandidates.length === 0 && variantCandidates.length === 0) {
    return [...products];
  }

  const offerAvailabilityPromise: Promise<AvailabilityPair[]> = Promise.all(
    offerCandidates.map(async (product) => {
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

        return [
          product.id,
          {
            available: hasStockedOffer(data),
            offers: normalizeOfferRows(data),
          },
        ] as const;
      } catch (error) {
        console.warn('Related blog product offer availability unavailable', {
          productId: product.id,
          error,
        });
        return [product.id, undefined] as const;
      }
    })
  );
  const variantAvailabilityPromise: Promise<AvailabilityPair[]> =
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
              return variantCandidates.map<AvailabilityPair>((product) => [
                product.id,
                undefined,
              ]);
            }

            return variantCandidates.map(
              (product) =>
                [
                  product.id,
                  {
                    available: hasStockedVariant(data, product.id),
                    variants: normalizeVariantRows(data, product),
                  },
                ] satisfies AvailabilityPair
            );
          } catch (error) {
            console.warn(
              'Related blog product variant availability unavailable',
              {
                productIds: variantCandidates.map((product) => product.id),
                error,
              }
            );
            return variantCandidates.map<AvailabilityPair>((product) => [
              product.id,
              undefined,
            ]);
          }
        })()
      : Promise.resolve([] as AvailabilityPair[]);
  const [offerAvailability, variantAvailability] = await Promise.all([
    offerAvailabilityPromise,
    variantAvailabilityPromise,
  ]);

  const offerAvailabilityById = new Map(offerAvailability);
  const variantAvailabilityById = new Map(variantAvailability);
  return products.map((product) => {
    const offerResolution = offerAvailabilityById.get(product.id);
    const variantResolution = variantAvailabilityById.get(product.id);
    return {
      ...product,
      ...(offerResolution?.available !== undefined
        ? { has_purchasable_condition_offer: offerResolution.available }
        : {}),
      ...(offerResolution?.offers ? { offers: offerResolution.offers } : {}),
      ...(variantResolution?.available !== undefined
        ? { has_purchasable_variant: variantResolution.available }
        : {}),
      ...(variantResolution?.variants
        ? { variants: variantResolution.variants }
        : {}),
    };
  });
}
