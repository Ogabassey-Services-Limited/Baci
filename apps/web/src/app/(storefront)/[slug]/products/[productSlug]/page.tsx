import type { Metadata, ResolvingMetadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
  getCachedLegacyProductRedirectTarget,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProduct,
  getCachedProductRatingStats,
  getCachedProductReviews,
  getCachedProductWithDetails,
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
import { isDomainIdentifier } from '@/lib/validation';
import type { FAQItem } from '@/types/faq';
import ProductDetailClient from './product-detail-client';
import {
  mapDetailedCachedProductToProduct,
  mapLegacyCachedProductToProduct,
} from './product-mappers';

interface PageProps {
  params: Promise<{
    slug: string; // Store slug
    productSlug: string; // Product slug or ID
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getProductCached(
  storeSlug: string,
  productSlug: string
): Promise<Product | null> {
  const merchant = storeSlug.includes('.')
    ? await getCachedMerchantByDomain(storeSlug)
    : await getCachedMerchant(storeSlug);

  if (!merchant) {
    console.error('Merchant not found for slug:', storeSlug);
    return null;
  }

  const cachedProduct = await getCachedProduct(merchant.id, productSlug);

  if (cachedProduct) {
    return mapLegacyCachedProductToProduct(cachedProduct, merchant.id);
  }

  const detailedProduct = await getCachedProductWithDetails(
    merchant.id,
    productSlug
  );

  if (!detailedProduct) {
    console.error('Product not found:', productSlug);
    return null;
  }

  return mapDetailedCachedProductToProduct(detailedProduct, merchant.id);
}

async function redirectLegacyProductRouteIfCategorized(
  storeSlug: string,
  product: Product
) {
  const productPath = getProductUrl(product);
  if (productPath.startsWith('/products/')) {
    return;
  }

  const headersList = await headers();
  const isPathMode =
    !headersList.has('x-merchant-slug') &&
    !headersList.has('x-custom-domain') &&
    !isDomainIdentifier(storeSlug);
  const targetPath = isPathMode ? `/${storeSlug}${productPath}` : productPath;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic route path requires type assertion
  permanentRedirect(targetPath as any);
}

async function resolveStoreMerchant(storeSlug: string) {
  return storeSlug.includes('.')
    ? await getCachedMerchantByDomain(storeSlug)
    : await getCachedMerchant(storeSlug);
}

async function redirectLegacyVariantProductRoute(
  storeSlug: string,
  productSlug: string
): Promise<never> {
  const merchant = await resolveStoreMerchant(storeSlug);

  if (!merchant) {
    notFound();
  }

  const redirectTarget = await getCachedLegacyProductRedirectTarget(
    merchant.id,
    productSlug
  );

  if (!redirectTarget) {
    notFound();
  }

  const productPath = getProductUrl(redirectTarget);
  const headersList = await headers();
  const isPathMode =
    !headersList.has('x-merchant-slug') &&
    !headersList.has('x-custom-domain') &&
    !isDomainIdentifier(storeSlug);
  const targetPath = isPathMode ? `/${storeSlug}${productPath}` : productPath;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic route path requires type assertion
  permanentRedirect(targetPath as any);
}

export async function generateMetadata(
  { params, searchParams }: PageProps,
  __parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const product = await getProductCached(slug, productSlug);

  if (!product) {
    await redirectLegacyVariantProductRoute(slug, productSlug);
    notFound();
  }

  const resolvedProduct = product;

  await redirectLegacyProductRouteIfCategorized(slug, resolvedProduct);

  // Get cached merchant data (handle custom domains)
  const merchant = await resolveStoreMerchant(slug);
  const baseUrl = buildStoreUrl(
    merchant ??
      (isDomainIdentifier(slug)
        ? { slug, custom_domain: slug }
        : { slug, custom_domain: undefined })
  );

  let canonicalUrl = resolvedProduct.canonical_url;

  if (!canonicalUrl) {
    const productPath = getProductUrl(resolvedProduct);
    const basePath = `${baseUrl}${productPath}`;
    canonicalUrl = constructCanonicalUrl(basePath, resolvedSearchParams, [
      'variant',
    ]);
  }

  const socialMedia = merchant?.social_media as
    | Record<string, string>
    | undefined;

  return {
    title:
      resolvedProduct.meta_title ||
      `${resolvedProduct.name} | ${merchant?.business_name || 'Baci Store'}`,
    description:
      resolvedProduct.meta_description ||
      resolvedProduct.description ||
      `Buy ${resolvedProduct.name} at ${merchant?.business_name || 'Ogabassey'}. Best price and fast delivery.`,
    keywords: resolvedProduct.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: resolvedProduct.meta_title || resolvedProduct.name,
      description:
        resolvedProduct.meta_description || resolvedProduct.description,
      images: resolvedProduct.images?.map((img) => ({
        url: img.url,
        alt: img.alt,
      })) || [
        {
          url: resolvedProduct.imageLarge || resolvedProduct.image,
          width: 800,
          height: 600,
          alt: resolvedProduct.name,
        },
      ],
      url: canonicalUrl,
      type: 'website',
      siteName: merchant?.business_name,
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedProduct.meta_title || resolvedProduct.name,
      description:
        resolvedProduct.meta_description || resolvedProduct.description,
      images: [resolvedProduct.imageLarge || resolvedProduct.image],
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

  const product = await getProductCached(slug, productSlug);

  if (!product) {
    await redirectLegacyVariantProductRoute(slug, productSlug);
    notFound();
  }

  const resolvedProduct = product;

  await redirectLegacyProductRouteIfCategorized(slug, resolvedProduct);

  const merchant = await resolveStoreMerchant(slug);
  const reviewStats = await getCachedProductRatingStats(resolvedProduct.id);
  const recentReviews = await getCachedProductReviews(resolvedProduct.id, {
    limit: 10,
  });

  if (recentReviews && recentReviews.length > 0) {
    resolvedProduct.reviews = recentReviews.map((r) => ({
      author: r.reviewer_name || 'Anonymous',
      datePublished: r.created_at,
      reviewBody: r.review_text || '',
      reviewRating: r.rating,
    }));
  }

  const baseUrl = buildStoreUrl(
    merchant ??
      (isDomainIdentifier(slug)
        ? { slug, custom_domain: slug }
        : { slug, custom_domain: undefined })
  );

  const productSchema = generateProductSchema(
    resolvedProduct,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG',
    merchant?.logo_url
  );
  const productPath = getProductUrl(resolvedProduct);
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
    resolvedProduct.category_slug ||
    (resolvedProduct.category
      ? generateSlug(resolvedProduct.category)
      : 'products');
  const categoryName =
    resolvedProduct.categories?.name ||
    resolvedProduct.category ||
    'All Products';
  const categoryUrl = `${baseUrl}/${categorySlug}`;

  const breadcrumbItems = [
    { name: merchant?.business_name || 'Home', url: baseUrl },
    { name: categoryName, url: categoryUrl },
    { name: resolvedProduct.name, url: productUrl },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
  const productFaqs = (resolvedProduct as unknown as { faqs?: FAQItem[] }).faqs;
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
        <ProductDetailClient product={resolvedProduct} faqs={productFaqs} />
      </Suspense>
    </>
  );
}
