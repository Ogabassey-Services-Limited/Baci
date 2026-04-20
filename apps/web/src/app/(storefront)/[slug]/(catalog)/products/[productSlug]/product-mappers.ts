import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { generateSlug } from '@/lib/seo-utils';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';

export type RawProductImage =
  | string
  | {
      url: string;
      alt?: string;
      order?: number;
    };

type StorefrontProductVariants = Parameters<
  typeof normalizeStorefrontProductVariants
>[0];

export interface LegacyCachedProduct {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  slug?: string | null;
  sale_price?: number | null;
  base_price: number;
  track_quantity?: boolean | null;
  quantity?: number | null;
  images?: RawProductImage[] | null;
  product_variants?: StorefrontProductVariants;
  product_categories?: Array<{
    categories:
      | {
          id: string;
          name: string;
          slug: string;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
        }>
      | null;
  }> | null;
  specifications?: unknown;
  product_key_specs?: unknown;
}

export interface DetailedCachedProduct {
  id: string;
  merchant_id?: string | null;
  name: string;
  description?: string | null;
  status?: string | null;
  slug?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  manage_stock?: boolean | null;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  images?: RawProductImage[] | null;
  imageHint?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  category?: string | null;
  categories?:
    | {
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }>
    | null;
  product_variants?: StorefrontProductVariants;
  specifications?: unknown;
  product_key_specs?: unknown;
  has_condition_offers?: boolean | null;
  variant_model?: 'legacy' | 'sku_matrix' | null;
  available_conditions?: string[] | null;
  offers?:
    | {
        id: string;
        condition: 'new' | 'used' | 'open_box' | 'refurbished';
        price: number;
        stock_quantity: number;
        images?: string[];
      }[]
    | null;
}

export function normalizeProductImages(
  productName: string,
  rawImages: RawProductImage[] | null | undefined
) {
  return rawImages?.map((img, idx) => {
    if (typeof img === 'string') {
      return { url: img, alt: productName, order: idx };
    }

    return {
      url: img.url,
      alt: img.alt || productName,
      order: img.order ?? idx,
    };
  });
}

export function mapLegacyCachedProductToProduct(
  cachedProduct: LegacyCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = cachedProduct.product_categories?.[0]?.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    cachedProduct.name,
    cachedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    cachedProduct.product_variants,
    {
      merchantId,
      productId: cachedProduct.id,
    }
  );

  return {
    id: cachedProduct.id,
    name: cachedProduct.name,
    description: cachedProduct.description || '',
    status: cachedProduct.status as 'draft' | 'active' | 'archived',
    slug: cachedProduct.slug || cachedProduct.id,
    // Use nullish coalescing so a legitimate `0` sale_price (free promo,
    // giveaway) is preserved rather than coerced up to base_price.
    price: cachedProduct.sale_price ?? cachedProduct.base_price,
    compare_at_price:
      cachedProduct.sale_price !== null &&
      cachedProduct.sale_price !== undefined
        ? cachedProduct.base_price
        : undefined,
    manage_stock: cachedProduct.track_quantity ?? false,
    stock: cachedProduct.quantity ?? 0,
    image: firstImage,
    imageLarge: firstImage,
    imageHint: cachedProduct.name,
    images: normalizedImages,
    brand: '',
    gtin: '',
    mpn: '',
    category: primaryCategory?.name || undefined,
    category_slug: primaryCategory?.slug || undefined,
    has_variants: normalizedVariants.length > 0,
    variants: normalizedVariants,
    specifications: cachedProduct.specifications as Product['specifications'],
    product_key_specs:
      cachedProduct.product_key_specs as Product['product_key_specs'],
  };
}

export function mapDetailedCachedProductToProduct(
  detailedProduct: DetailedCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = detailedProduct.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    detailedProduct.name,
    detailedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    detailedProduct.product_variants,
    {
      merchantId: detailedProduct.merchant_id || merchantId,
      productId: detailedProduct.id,
    }
  );

  return {
    id: detailedProduct.id,
    merchant_id: detailedProduct.merchant_id || merchantId,
    name: detailedProduct.name,
    description: detailedProduct.description || '',
    status: (detailedProduct.status || 'active') as
      | 'draft'
      | 'active'
      | 'archived',
    slug: detailedProduct.slug || detailedProduct.id,
    price:
      typeof detailedProduct.price === 'string'
        ? Number.parseFloat(detailedProduct.price) || 0
        : detailedProduct.price || 0,
    compare_at_price:
      typeof detailedProduct.compare_at_price === 'string'
        ? Number.parseFloat(detailedProduct.compare_at_price) || undefined
        : detailedProduct.compare_at_price || undefined,
    manage_stock: detailedProduct.manage_stock ?? false,
    stock: getEffectiveStock(detailedProduct),
    image: firstImage,
    imageLarge: firstImage,
    imageHint: detailedProduct.imageHint || detailedProduct.name,
    images: normalizedImages,
    brand: detailedProduct.brand || '',
    gtin: detailedProduct.gtin || '',
    mpn: detailedProduct.mpn || '',
    category: primaryCategory?.name || detailedProduct.category || undefined,
    category_slug:
      primaryCategory?.slug ||
      (detailedProduct.category
        ? generateSlug(detailedProduct.category)
        : undefined),
    categories: primaryCategory
      ? {
          id: primaryCategory.id,
          name: primaryCategory.name,
          slug: primaryCategory.slug,
          parent_id: primaryCategory.parent_id ?? undefined,
        }
      : null,
    has_variants: normalizedVariants.length > 0,
    has_condition_offers: detailedProduct.has_condition_offers ?? false,
    variant_model:
      detailedProduct.variant_model === 'sku_matrix' ? 'sku_matrix' : 'legacy',
    available_conditions:
      Array.isArray(detailedProduct.available_conditions) &&
      detailedProduct.available_conditions.every(
        (value) => typeof value === 'string'
      )
        ? (detailedProduct.available_conditions as Product['available_conditions'])
        : undefined,
    offers: detailedProduct.offers ?? [],
    variants: normalizedVariants,
    specifications: detailedProduct.specifications as Product['specifications'],
    product_key_specs:
      detailedProduct.product_key_specs as Product['product_key_specs'],
  } as Product;
}
