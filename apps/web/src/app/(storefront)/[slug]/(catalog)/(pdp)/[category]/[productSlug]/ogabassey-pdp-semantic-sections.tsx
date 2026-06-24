import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import type { Product } from '@/lib/products';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import {
  getCachedProductSeoLinkData,
  type ProductSeoLinkData,
} from '@/lib/storefront-product/get-cached-product-seo-link-data';

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
  // Strict, cache-isolated fetch: throws on a transient inventory failure so a
  // link-poor result is never cached (stale-while-revalidate serves last-good).
  // Server components cannot rely on client error boundaries during the initial
  // SSR pass, so cold-cache failures must degrade here before reaching the
  // route error boundary. Warm cache failures serve last-good data via
  // stale-while-revalidate and do not reach this catch.
  let seoLinkData: ProductSeoLinkData;

  try {
    seoLinkData = await getCachedProductSeoLinkData(
      merchant.id,
      categorySlug,
      storeSlug,
      String(product.id || '')
    );
  } catch (error) {
    console.warn('Failed to load Ogabassey PDP semantic links', {
      merchantId: merchant.id,
      categorySlug,
      productId: product.id,
      error,
    });
    return null;
  }

  const { inventory, guidePosts, priorityGuidePostSlugs } = seoLinkData;
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
    priorityGuidePostSlugs,
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
