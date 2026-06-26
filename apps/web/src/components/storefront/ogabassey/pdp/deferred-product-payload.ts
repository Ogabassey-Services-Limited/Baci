import type { Product as RelatedProduct } from '@/lib/products';
import type { Product } from '@/components/storefront/ogabassey/types';
import {
  normalizeProductDetails,
  type NormalizedProductDetails,
} from '@/components/storefront/ogabassey/pages/product-details-page/product-details-helpers';
import { toRelatedProductsProduct } from '@/components/storefront/ogabassey/pages/product-details-page/related-product';

export type OgabasseyPdpDeferredTabProduct = Product &
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
    description: normalized.description,
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
    relatedProduct: toRelatedProductsProduct(product),
    tabProduct,
  };
}
