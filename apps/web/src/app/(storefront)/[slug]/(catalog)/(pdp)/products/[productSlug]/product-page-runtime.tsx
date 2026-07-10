import { headers } from 'next/headers';
import { JsonLd } from '@/components/seo/json-ld';
import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import {
  getCachedCategoryPageData,
  getCachedProductRatingStats,
  getCachedProductReviews,
} from '@/lib/cached-data';
import { isKorapayConfigured } from '@/lib/korapay';
import { isPaystackConfigured } from '@/lib/paystack';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
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
import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import { loadPublishedClusterPostsSafely } from '@/lib/storefront-content/load-published-cluster-posts-safely';
import { buildProductContextParagraphs } from '@/lib/storefront-product/build-product-context-paragraphs';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import { buildProductPriceSeoCopy } from '@/lib/storefront-product-price-seo';
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

export async function ProductPageRuntime({
  merchant,
  product,
  slug,
}: ProductPageRuntimeProps) {
  // categorySlug/supportedClusterCategory only depend on `product` (already
  // resolved), so they're computed up front to fold the category-page-data +
  // guide-posts fetch into the same Promise.all as the review fetch below —
  // neither pair depends on the other's result, and merging them removes a
  // sequential await hop (the category fetch previously waited for the
  // unrelated review fetch to settle first).
  const categorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : 'products');
  const supportedClusterCategory =
    categorySlug in CONTENT_CLUSTER_SUPPORT
      ? (categorySlug as SupportedClusterCategory)
      : null;
  const [reviewStats, recentReviews, categoryPageData, guidePosts] =
    await Promise.all([
      getCachedProductRatingStats(product.id),
      getCachedProductReviews(product.id, { limit: 10 }),
      getCachedCategoryPageData(merchant.id, categorySlug, slug),
      supportedClusterCategory
        ? loadPublishedClusterPostsSafely(merchant.id, {
            pageKind: 'product',
            categorySlug: supportedClusterCategory,
            brands: product.brand ? [product.brand] : undefined,
            productSlugs: product.slug ? [product.slug] : undefined,
          })
        : Promise.resolve([]),
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
  const currency = resolveMerchantCurrencyConfig(merchant).code;
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

  const categoryName =
    product.categories?.name || product.category || 'All Products';
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
  const currentProduct = {
    slug: product.slug || String(product.id),
    name: product.name,
    brand: product.brand,
    condition: product.condition,
    price: product.price,
    stock: product.stock,
    category_slug: product.category_slug ?? categorySlug,
    product_key_specs: product.product_key_specs,
  };
  const semanticModel = buildProductSemanticModel({
    storeUrl: baseUrl,
    merchantBusinessName: merchant.business_name || 'Baci Store',
    categorySlug,
    categoryName,
    countryCode: merchant.country,
    currentProduct,
    inventory: inventoryCandidates,
    guidePosts,
  });
  const priceSeoCopy = buildProductPriceSeoCopy({
    product,
    merchantDisplayName: merchant.business_name || 'Baci Store',
    categoryName,
    currency,
    country: merchant.country,
  });
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
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <ProductDetailClient product={product} faqs={productFaqs} />
      <ProductSemanticSections
        model={{
          ...semanticModel,
          contextParagraphs: buildProductContextParagraphs({
            categoryName,
            categorySlug,
            currentProduct,
            displayPriceText: priceSeoCopy.priceText,
            merchantBusinessName: merchant.business_name || 'Baci Store',
            semanticModel,
          }),
        }}
      />
    </>
  );
}
