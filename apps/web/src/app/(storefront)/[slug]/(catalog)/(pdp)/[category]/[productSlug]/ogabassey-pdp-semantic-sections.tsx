import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import { getCachedCategoryPageData } from '@/lib/cached-data';
import type { Product } from '@/lib/products';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { getPublishedProductGuidePosts } from '@/lib/storefront-content/get-published-product-guide-posts';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

interface OgabasseyPdpSemanticMerchant {
  business_name?: string | null;
  country?: string | null;
  id: string;
}

interface OgabasseyPdpSemanticSectionsProps {
  categoryName: string;
  categorySlug: string;
  merchant: OgabasseyPdpSemanticMerchant;
  product: Product;
  storeSlug: string;
  storeUrl: string;
  trustBullets: string[];
}

export async function OgabasseyPdpSemanticSections({
  categoryName,
  categorySlug,
  merchant,
  product,
  storeSlug,
  storeUrl,
  trustBullets,
}: OgabasseyPdpSemanticSectionsProps) {
  const productId = String(product.id || '');
  const [categoryPageData, clusterGuidePosts, productGuidePosts] =
    await Promise.all([
      getCachedCategoryPageData(merchant.id, categorySlug, storeSlug),
      getPublishedClusterPosts(merchant.id),
      getPublishedProductGuidePosts(merchant.id, productId),
    ]);
  const guidePosts = mergeGuidePosts(productGuidePosts, clusterGuidePosts);
  const inventory = (
    categoryPageData?.isCollection ? [] : (categoryPageData?.products ?? [])
  )
    .filter(isProductSemanticCandidate)
    .map(toProductSemanticCandidate);
  const semanticModel = buildProductSemanticModel({
    storeUrl,
    merchantBusinessName: merchant?.business_name || 'Baci Store',
    categorySlug,
    categoryName,
    countryCode: merchant.country,
    currentProduct: {
      slug: product.slug || String(product.id),
      name: product.name,
      brand: product.brand,
      condition: product.condition,
      price: product.price,
      stock: product.stock,
      category_slug: product.category_slug ?? categorySlug,
      product_key_specs: product.product_key_specs,
    },
    inventory,
    guidePosts,
  });

  return (
    <ProductSemanticSections
      model={{
        ...semanticModel,
        trustBullets: [...trustBullets, ...semanticModel.trustBullets],
      }}
    />
  );
}

function isProductSemanticCandidate(
  candidate: unknown
): candidate is ProductSemanticCandidate {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const product = candidate as Record<string, unknown>;
  return (
    typeof product.slug === 'string' &&
    typeof product.name === 'string' &&
    typeof product.price === 'number'
  );
}

function toProductSemanticCandidate(
  product: ProductSemanticCandidate
): ProductSemanticCandidate {
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    condition: product.condition,
    price: product.price,
    stock: product.stock,
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  };
}

function mergeGuidePosts<T extends { slug: string }>(
  priorityPosts: T[],
  fallbackPosts: T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const post of [...priorityPosts, ...fallbackPosts]) {
    if (!post.slug || seen.has(post.slug)) {
      continue;
    }

    seen.add(post.slug);
    merged.push(post);
  }

  return merged;
}
