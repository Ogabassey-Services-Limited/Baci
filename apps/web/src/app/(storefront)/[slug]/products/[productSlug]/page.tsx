import type { Metadata, ResolvingMetadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
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

export const dynamic = 'force-dynamic';

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

export async function generateMetadata(
  { params, searchParams }: PageProps,
  __parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const product = await getProductCached(slug, productSlug);

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  await redirectLegacyProductRouteIfCategorized(slug, product);

  // Get cached merchant data (handle custom domains)
  const merchant = slug.includes('.')
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);
  const baseUrl = buildStoreUrl(
    merchant ??
      (isDomainIdentifier(slug)
        ? { slug, custom_domain: slug }
        : { slug, custom_domain: undefined })
  );

  let canonicalUrl = product.canonical_url;

  if (!canonicalUrl) {
    const productPath = getProductUrl(product);
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
      product.meta_title ||
      `${product.name} | ${merchant?.business_name || 'Baci Store'}`,
    description:
      product.meta_description ||
      product.description ||
      `Buy ${product.name} at ${merchant?.business_name || 'Ogabassey'}. Best price and fast delivery.`,
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
      siteName: merchant?.business_name,
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
  const { slug, productSlug } = await params;

  const product = await getProductCached(slug, productSlug);

  if (!product) {
    notFound();
  }

  await redirectLegacyProductRouteIfCategorized(slug, product);

  const merchant = slug.includes('.')
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);
  const reviewStats = await getCachedProductRatingStats(product.id);
  const recentReviews = await getCachedProductReviews(product.id, {
    limit: 10,
  });

  if (recentReviews && recentReviews.length > 0) {
    product.reviews = recentReviews.map((r) => ({
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
    product,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG',
    merchant?.logo_url
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
    { name: merchant?.business_name || 'Home', url: baseUrl },
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
