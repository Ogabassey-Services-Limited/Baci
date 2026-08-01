import type { Product as RelatedProduct } from '@/lib/products';
import type { Product } from '@/components/storefront/ogabassey/types';
import {
  normalizeProductDetails,
  type NormalizedProductDetails,
} from '@/components/storefront/ogabassey/pages/product-details-page/product-details-helpers';
import { toRelatedProductsProduct } from '@/components/storefront/ogabassey/pages/product-details-page/related-product';

// `description` is deliberately OMITTED from the client tab payload. Long PDP
// descriptions are multi-KB of sanitized HTML; the tabs island renders the
// description server-side as a `descriptionSlot` (see deferred-detail-island.tsx)
// and no client consumer reads `.description` off this type anymore. The only
// indirect touch — ProductComparisonTable's `buildProductSpecData(mainProduct)`
// — is redundant here because the description-derived key specs are already
// baked into the server-computed `detailedSpecs`. Keeping it off the type shrinks
// the RSC/flight payload serialized into the island props on every PDP.
export type OgabasseyPdpDeferredTabProduct = Omit<Product, 'description'> &
  Pick<
    NormalizedProductDetails,
    | 'colorImages'
    | 'colors'
    | 'condition'
    | 'detailedSpecs'
    | 'images'
    | 'platforms'
    | 'rating'
    | 'reviewCount'
    | 'specs'
    | 'storage'
  >;

export interface OgabasseyPdpDeferredProductPayload {
  /**
   * The stored product description, returned OUT-OF-BAND from `tabProduct`
   * so the server can render it into the `descriptionSlot` (`<SafeHtml>`)
   * without serializing the multi-KB HTML into the client island props.
   */
  description: string;
  relatedProduct: RelatedProduct;
  tabProduct: OgabasseyPdpDeferredTabProduct;
}

export function buildOgabasseyPdpDeferredProductPayload(
  product: Product
): OgabasseyPdpDeferredProductPayload {
  const normalized = normalizeProductDetails(product);
  const compactImages = normalized.images.slice(0, 2);
  const tabProduct: OgabasseyPdpDeferredTabProduct = {
    brand: normalized.brand,
    category: normalized.category,
    category_id: normalized.category_id,
    categorySlug: normalized.categorySlug,
    colorImages: normalized.colorImages,
    colors: normalized.colors,
    condition: normalized.condition,
    detailedSpecs: normalized.detailedSpecs,
    displaySize: normalized.displaySize,
    displayType: normalized.displayType,
    id: normalized.id,
    image: compactImages[0] || normalized.image,
    images: compactImages,
    manage_stock: normalized.manage_stock,
    merchantId: normalized.merchantId,
    name: normalized.name,
    platforms: normalized.platforms,
    price: normalized.price,
    product_key_specs: normalized.product_key_specs,
    ram: normalized.ram,
    rating: normalized.rating,
    rawPrice: normalized.rawPrice,
    reviewCount: normalized.reviewCount,
    reviews: normalized.reviews,
    simType: normalized.simType,
    slug: normalized.slug,
    spec: normalized.spec,
    specs: normalized.specs,
    stock: normalized.stock,
    storage: normalized.storage,
    variant_attributes: normalized.variant_attributes,
    videoUrl: normalized.videoUrl,
  };

  if (normalized.categories) {
    tabProduct.categories = {
      id: normalized.categories.id,
      name: normalized.categories.name,
      parent_id: normalized.categories.parent_id ?? undefined,
      slug: normalized.categories.slug,
    };
  }

  return {
    description: product.description?.trim() ? product.description : '',
    relatedProduct: toRelatedProductsProduct(product),
    tabProduct,
  };
}
