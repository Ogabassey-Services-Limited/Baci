import { headers } from 'next/headers';
import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import {
  getCachedCategoryPageData,
  getCachedProductRatingStats,
  getCachedProductReviews,
} from '@/lib/cached-data';
import { isKorapayConfigured } from '@/lib/korapay';
import { isPaystackConfigured } from '@/lib/paystack';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  buildStorefrontAcceptedPaymentMethods,
  generateAggregateRating,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateProductSchema,
  generateSlug,
  getValidatedProductUrl,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import { buildProductPriceSeoCopy } from '@/lib/storefront-product-price-seo';
import {
  DEFAULT_STORE_NAME,
  DEFAULT_STOREFRONT_SEO_CATEGORY,
} from '@/lib/storefront-seo-defaults';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { FAQItem } from '@/types/faq';
import ProductDetailClient from './product-detail-client';
import type { ProductPageRuntimeProps } from './product-page-types';

interface SemanticInventoryCandidateProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  condition?: string | null;
  stock?: number | null;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

function buildTrustBulletsFromProfile(
  trustProfile: Awaited<ReturnType<typeof buildMerchantTrustProfile>>
): string[] {
  const bullets: string[] = [];
  const returnPolicy = trustProfile.returnPolicy;
  if (returnPolicy?.windowDays != null) {
    bullets.push(
      returnPolicy.returnFees === 'free'
        ? `Free returns within ${returnPolicy.windowDays} days`
        : `Returns within ${returnPolicy.windowDays} days`
    );
  }

  const shippingPolicy = trustProfile.shippingPolicy;
  const regions = shippingPolicy?.regions ?? [];
  const regionsText = regions.join(' ').toLowerCase();
  if (
    regions.some(
      (region) => region.toUpperCase() === 'NG' || /nigeria/i.test(region)
    ) ||
    /nationwide/.test(shippingPolicy?.summary ?? '') ||
    /nigeria/.test(regionsText)
  ) {
    bullets.push('Ships across Nigeria');
  }

  if (trustProfile.whatsappNumber) {
    bullets.push('WhatsApp support available');
  }

  return bullets;
}

export async function ProductPageRuntime({
  merchant,
  product,
  slug,
}: ProductPageRuntimeProps) {
  const [reviewStats, recentReviews] = await Promise.all([
    getCachedProductRatingStats(product.id),
    getCachedProductReviews(product.id, { limit: 10 }),
  ]);
  // `product` comes from the request-scoped product cache. Mutating it in place
  // would pollute the shared reference for subsequent renders in the same
  // request or across requests that replay the same cache entry.
  const productWithReviews =
    recentReviews && recentReviews.length > 0
      ? {
          ...product,
          reviews: recentReviews.map((r) => ({
            author: r.reviewer_name || 'Anonymous',
            datePublished: r.created_at,
            reviewBody: r.review_text || '',
            reviewRating: r.rating,
          })),
        }
      : product;
  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const currency = merchant.payout_currency || 'NGN';
  const priceCategoryName =
    product.categories?.name ||
    product.category ||
    DEFAULT_STOREFRONT_SEO_CATEGORY;
  const priceSeoCopy = buildProductPriceSeoCopy({
    product,
    merchantDisplayName: merchant.business_name || DEFAULT_STORE_NAME,
    categoryName: priceCategoryName,
    currency,
    country: merchant.country,
  });
  const productUrl = getValidatedProductUrl(product, baseUrl, merchant.slug);
  const productSchema = generateProductSchema(
    productWithReviews,
    merchant.business_name || 'Baci Store',
    currency,
    merchant.country || 'NG',
    merchant.logo_url,
    trustProfile,
    {
      acceptedPaymentMethods: buildStorefrontAcceptedPaymentMethods(merchant, {
        korapayConfigured: isKorapayConfigured(),
        paystackConfigured: isPaystackConfigured(),
        currency,
      }),
      productUrl,
    }
  );
  if (reviewStats && reviewStats.totalReviews > 0) {
    const aggregateRating = generateAggregateRating({
      averageRating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
    });
    if (aggregateRating) {
      productSchema.aggregateRating = aggregateRating;
    }
  }

  const categorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : 'products');
  const categoryName =
    product.categories?.name || product.category || 'All Products';
  const categoryPageData = await getCachedCategoryPageData(
    merchant.id,
    categorySlug,
    slug
  );
  const guidePosts = await getPublishedClusterPosts(merchant.id);
  const inventoryCandidates = (
    categoryPageData?.isCollection ? [] : (categoryPageData?.products ?? [])
  ).map((candidate) => {
    const productCandidate = candidate as SemanticInventoryCandidateProduct;

    return {
      slug: productCandidate.slug,
      name: productCandidate.name,
      brand: productCandidate.brand,
      condition: productCandidate.condition,
      price: productCandidate.price,
      stock: productCandidate.stock,
      category_slug: productCandidate.category_slug,
      product_key_specs: productCandidate.product_key_specs,
    };
  });
  const semanticModel = buildProductSemanticModel({
    storeUrl: baseUrl,
    merchantBusinessName: merchant.business_name || 'Baci Store',
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
    inventory: inventoryCandidates,
    guidePosts,
  });
  const semanticSectionsModel = {
    ...semanticModel,
    trustBullets: [
      priceSeoCopy.answer,
      ...buildTrustBulletsFromProfile(trustProfile),
      ...semanticModel.trustBullets,
    ],
  };
  const categoryUrl = `${baseUrl}/${categorySlug}`;
  const breadcrumbItems = [
    { name: merchant.business_name || 'Home', url: baseUrl },
    { name: categoryName, url: categoryUrl },
    { name: product.name, url: productUrl },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
  const productFaqs = (product as unknown as { faqs?: FAQItem[] }).faqs;
  const faqSchema =
    productFaqs && productFaqs.length > 0
      ? generateFAQSchema(productFaqs)
      : null;
  return (
    <>
      <script type="application/ld+json">
        {safeJsonLdStringify(productSchema)}
      </script>
      <script type="application/ld+json">
        {safeJsonLdStringify(breadcrumbSchema)}
      </script>
      {faqSchema && (
        <script type="application/ld+json">
          {safeJsonLdStringify(faqSchema)}
        </script>
      )}
      <ProductDetailClient product={product} faqs={productFaqs} />
      <ProductSemanticSections model={semanticSectionsModel} />
    </>
  );
}
