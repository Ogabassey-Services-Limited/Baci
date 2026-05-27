import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import type { getCachedCategoryPageData } from '@/lib/cached-data';
import {
  normalizeProduct,
  type ProductKeySpecsRecord,
  type RawDbProduct,
} from '@/lib/normalize-product';
import { buildCategoryHubModel } from '@/lib/storefront-category/build-category-hub-model';
import type { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';

type CategoryPageData = Awaited<ReturnType<typeof getCachedCategoryPageData>>;

export type StorefrontCategoryProduct = OgabasseyProduct & {
  rawPrice: number;
  category_slug: string;
  product_key_specs?: ProductKeySpecsRecord;
};

const CONDITION_MAP: Record<string, OgabasseyProduct['condition']> = {
  New: 'New',
  new: 'New',
  Used: 'Used',
  used: 'Used',
  'Open Box': 'Open Box',
  open_box: 'Open Box',
  Refurbished: 'refurbished',
  refurbished: 'refurbished',
};

export function resolveCategoryPageName(
  data: CategoryPageData,
  categorySlug: string
) {
  return data.isCollection
    ? data.name || categorySlug
    : data.fallbackName || categorySlug;
}

export function normalizeCategoryPageProducts(
  products: RawDbProduct[],
  preferredCategorySlug?: string
): StorefrontCategoryProduct[] {
  return products.map((product) => {
    const normalized = normalizeProduct(product, {
      preferredCategorySlug,
    });

    return {
      id: normalized.id,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      price: `₦${normalized.price.toLocaleString()}`,
      rawPrice: normalized.price,
      image: normalized.image,
      images: normalized.images,
      category: normalized.category,
      brand: normalized.brand ?? undefined,
      condition: CONDITION_MAP[normalized.condition] || 'New',
      stock: normalized.stock,
      category_slug: normalized.category_slug,
      product_key_specs: normalized.product_key_specs ?? undefined,
    };
  });
}

export function buildCategoryPageHubModel(input: {
  data: CategoryPageData;
  categorySlug: string;
  categoryName: string;
  merchantBusinessName: string;
  storeUrl: string;
  products: StorefrontCategoryProduct[];
  guidePosts?: Awaited<ReturnType<typeof getPublishedClusterPosts>>;
}) {
  return buildCategoryHubModel({
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    merchantBusinessName: input.merchantBusinessName,
    storeUrl: input.storeUrl,
    guidePosts: input.guidePosts ?? [],
    products: input.products.map((product) => ({
      slug: product.slug || '',
      name: product.name,
      brand: product.brand,
      condition: product.condition,
      price: product.rawPrice,
      category_slug: product.category_slug,
      product_key_specs: product.product_key_specs,
    })),
    categorySeo: input.data.isCollection
      ? undefined
      : {
          heading: input.data.category?.seo_heading,
          description: input.data.category?.seo_description,
          features: input.data.category?.seo_features,
          faqs: input.data.category?.seo_faq,
        },
    collectionSeo: input.data.isCollection ? input.data.seo : undefined,
    isCollection: input.data.isCollection,
  });
}
