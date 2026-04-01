import type { Metadata, ResolvingMetadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
  getCachedLegacyProductRedirectTarget,
  getCachedProduct,
  getCachedProductRatingStats,
  getCachedProductReviews,
  getCachedProductWithDetails,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import type { Product } from '@/lib/products';
import { escapeHtml } from '@/lib/sanitize-core';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  constructCanonicalUrl,
  generateAggregateRating,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateProductSchema,
  generateSlug,
  getProductUrl,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import type { FAQItem } from '@/types/faq';
import { buildProductRedirectPath } from './build-product-redirect-path';
import ProductDetailClient from './product-detail-client';
import {
  mapDetailedCachedProductToProduct,
  mapLegacyCachedProductToProduct,
} from './product-mappers';

interface PageProps {
  params: Promise<{
    slug: string;
    productSlug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type ResolvedMerchant = NonNullable<
  Awaited<ReturnType<typeof getRequestScopedMerchant>>
>;

interface ProductLookupResult {
  merchant: ResolvedMerchant;
  product: Product | null;
}

async function getProductCached(
  storeSlug: string,
  productSlug: string
): Promise<ProductLookupResult | null> {
  const merchant = await getRequestScopedMerchant(storeSlug);
  if (!merchant) {
    console.warn('Merchant not found for storefront product route:', storeSlug);
    return null;
  }
  const cachedProduct = await getCachedProduct(merchant.id, productSlug);
  if (cachedProduct) {
    return {
      merchant,
      product: mapLegacyCachedProductToProduct(cachedProduct, merchant.id),
    };
  }
  const detailedProduct = await getCachedProductWithDetails(
    merchant.id,
    productSlug
  );
  if (!detailedProduct) {
    console.warn('Product lookup miss', {
      merchantId: merchant.id,
      productSlug,
    });
    return { merchant, product: null };
  }

  return {
    merchant,
    product: mapDetailedCachedProductToProduct(detailedProduct, merchant.id),
  };
}

function redirectLegacyProductRouteIfCategorized(
  storeSlug: string,
  product: Product
) {
  const productPath = getProductUrl(product);
  if (productPath.startsWith('/products/')) {
    return;
  }
  const targetPath = buildProductRedirectPath(storeSlug, productPath);
  permanentRedirect(targetPath);
}

async function redirectLegacyVariantProductRoute(
  storeSlug: string,
  productSlug: string,
  merchant: ResolvedMerchant
): Promise<never> {
  const redirectTarget = await getCachedLegacyProductRedirectTarget(
    merchant.id,
    productSlug
  );
  if (!redirectTarget) {
    notFound();
  }
  const productPath = getProductUrl(redirectTarget);
  const targetPath = buildProductRedirectPath(storeSlug, productPath);
  permanentRedirect(targetPath);
}

export async function generateMetadata(
  { params, searchParams }: PageProps,
  __parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const productResult = await getProductCached(slug, productSlug);
  if (!productResult) {
    notFound();
  }
  const { merchant, product } = productResult;
  if (!product) {
    await redirectLegacyVariantProductRoute(slug, productSlug, merchant);
    notFound();
  }
  await redirectLegacyProductRouteIfCategorized(slug, product);
  const baseUrl = buildStoreUrl(merchant);
  let canonicalUrl = product.canonical_url;
  if (!canonicalUrl) {
    const productPath = getProductUrl(product);
    const basePath = `${baseUrl}${productPath}`;
    canonicalUrl = constructCanonicalUrl(basePath, resolvedSearchParams, [
      'variant',
    ]);
  }
  const socialMedia = merchant.social_media as
    | Record<string, string>
    | undefined;
  return {
    title:
      product.meta_title ||
      `${product.name} | ${merchant.business_name || 'Baci Store'}`,
    description:
      product.meta_description ||
      product.description ||
      `Buy ${product.name} at ${merchant.business_name || 'Ogabassey'}. Best price and fast delivery.`,
    keywords: product.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: product.meta_title || product.name,
      description: product.meta_description || product.description,
      images: product.images?.map((img) => ({
        url: img.url,
        alt: img.alt,
      })) || [
        {
          url: product.imageLarge || product.image,
          width: 800,
          height: 600,
          alt: product.name,
        },
      ],
      url: canonicalUrl,
      type: 'website',
      siteName: merchant.business_name,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.meta_title || product.name,
      description: product.meta_description || product.description,
      images: [product.imageLarge || product.image],
      ...(socialMedia?.twitter && {
        site: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
        creator: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
      }),
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  await connection();
  const { slug, productSlug } = await params;
  const productResult = await getProductCached(slug, productSlug);
  if (!productResult) {
    notFound();
  }
  const { merchant, product } = productResult;
  if (!product) {
    await redirectLegacyVariantProductRoute(slug, productSlug, merchant);
    notFound();
  }
  await redirectLegacyProductRouteIfCategorized(slug, product);
  const [reviewStats, recentReviews] = await Promise.all([
    getCachedProductRatingStats(product.id),
    getCachedProductReviews(product.id, { limit: 10 }),
  ]);
  if (recentReviews && recentReviews.length > 0) {
    product.reviews = recentReviews.map((r) => ({
      author: r.reviewer_name || 'Anonymous',
      datePublished: r.created_at,
      reviewBody: r.review_text || '',
      reviewRating: r.rating,
    }));
  }
  const baseUrl = buildStoreUrl(merchant);
  const productSchema = generateProductSchema(
    product,
    merchant.business_name || 'Baci Store',
    merchant.payout_currency || 'USD',
    merchant.country || 'NG',
    merchant.logo_url
  );
  const productPath = getProductUrl(product);
  const productUrl = `${baseUrl}${productPath}`;
  if (
    productSchema.offers &&
    !Array.isArray(productSchema.offers) &&
    productSchema.offers['@type'] !== 'AggregateOffer'
  ) {
    productSchema.offers.url = escapeHtml(productUrl);
  }
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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(faqSchema),
          }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        />
      )}
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailClient product={product} faqs={productFaqs} />
      </Suspense>
    </>
  );
}
