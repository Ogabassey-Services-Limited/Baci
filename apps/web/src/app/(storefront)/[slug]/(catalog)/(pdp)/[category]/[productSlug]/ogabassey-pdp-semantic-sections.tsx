import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import type { Product } from '@/lib/products';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import { getCachedProductSeoLinkData } from '@/lib/storefront-product/get-cached-product-seo-link-data';

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
  // Rendered behind a Suspense + error boundary by the caller. `inventory` is
  // already normalized to ProductSemanticCandidate[] inside the cached unit, and
  // product-linked guides are merged ahead of broader cluster guides there.
  const { inventory, guidePosts } = await getCachedProductSeoLinkData(
    merchant.id,
    categorySlug,
    storeSlug,
    String(product.id || '')
  );
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
