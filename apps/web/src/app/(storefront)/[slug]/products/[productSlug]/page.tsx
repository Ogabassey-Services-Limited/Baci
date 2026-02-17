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
import type { FAQItem } from '@/types/faq';
import ProductDetailClient from './product-detail-client';

interface PageProps {
  params: Promise<{
    slug: string; // Store slug
    productSlug: string; // Product slug or ID
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Get product using cached data functions
 * Falls back to cached product lookup for better performance
 */
async function getProductCached(
  storeSlug: string,
  productSlug: string
): Promise<Product | null> {
  // Get merchant first to get the merchant ID (handle custom domains)
  const merchant = storeSlug.includes('.')
    ? await getCachedMerchantByDomain(storeSlug)
    : await getCachedMerchant(storeSlug);

  if (!merchant) {
    console.error('Merchant not found for slug:', storeSlug);
    return null;
  }

  // Get product using cached function
  const cachedProduct = await getCachedProduct(merchant.id, productSlug);

  if (!cachedProduct) {
    console.error('Product not found:', productSlug);
    return null;
  }

  // Transform cached product to match Product interface
  // Map database fields to Product interface expected fields
  const productImages = cachedProduct.images as Array<{
    url: string;
    alt?: string;
    order?: number;
  }> | null;
  const firstImage = productImages?.[0]?.url || '';

  const product: Product = {
    id: cachedProduct.id,
    name: cachedProduct.name,
    description: cachedProduct.description || '',
    status: cachedProduct.status as 'draft' | 'active' | 'archived',
    slug: cachedProduct.slug,
    // Map base_price to price
    price: cachedProduct.sale_price || cachedProduct.base_price,
    compare_at_price: cachedProduct.sale_price
      ? cachedProduct.base_price
      : undefined,
    // Stock fields
    manage_stock: cachedProduct.track_quantity ?? false,
    stock: cachedProduct.quantity ?? 0,
    // Image fields
    image: firstImage,
    imageLarge: firstImage,
    imageHint: cachedProduct.name,
    images: productImages?.map((img, idx) => ({
      url: img.url,
      alt: img.alt || cachedProduct.name,
      order: img.order ?? idx,
    })),
    // Brand/identifiers (defaults for missing fields)
    brand: '',
    gtin: '',
    mpn: '',
    // Category from nested join (cast through unknown for Supabase type compatibility)
    category:
      (
        cachedProduct.product_categories?.[0]?.categories as unknown as {
          id: string;
          name: string;
          slug: string;
        } | null
      )?.name || undefined,
    category_slug:
      (
        cachedProduct.product_categories?.[0]?.categories as unknown as {
          slug: string;
        } | null
      )?.slug || undefined,
    // Variants
    has_variants: (cachedProduct.product_variants?.length ?? 0) > 0,
    variants:
      cachedProduct.product_variants?.map((v) => ({
        id: v.id,
        product_id: cachedProduct.id,
        merchant_id: merchant.id,
        attributes: v.attributes || {},
        stock_quantity: v.stock_quantity ?? 0,
        price_override: v.price_override,
      })) || [],
    // Specs for SEO Schema
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic JSON column from database
    specifications: cachedProduct.specifications as any,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic JSON column from database
    product_key_specs: cachedProduct.product_key_specs as any,
  };

  return product;
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

  // Get cached merchant data (handle custom domains)
  const merchant = slug.includes('.')
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  let baseUrl = `${protocol}://${host}`;

  // Only include slug in URL path for localhost (development)
  // For subdomains (merchant.usebaci.com) and custom domains (merchant.com),
  // the merchant identity is in the domain itself, not the path
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // FIX: Ensure canonical URL always points to the production custom domain if it exists
  // This prevents Vercel deployment URLs (e.g. baci-xyz.vercel.app) from being used as canonicals
  if (!isLocalhost && merchant?.custom_domain) {
    baseUrl = `https://${merchant.custom_domain}`;
  } else if (!isLocalhost && merchant?.slug && !host.includes(merchant.slug)) {
    // If we are on a generic domain but merchant has a slug-based subdomain (and not custom domain)
    // We generally trust the host, but if we are on vercel.app, we might want to enforce subdomain.
    // For now, custom_domain is the primary fix for the reported issue.
  }

  // If we have a category slug (explicit or generated), REDIRECT to the pretty URL (SEO Best Practice)
  // This ensures /products/ URLs are always canonicalized to their category-based counterparts
  const effectiveCategorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : undefined);

  if (effectiveCategorySlug) {
    const cleanSlug = product.slug || product.id;
    // Resolve stored slug (localhost/preview logic vs production subdomain logic)
    const targetPath = isLocalhost
      ? `/${slug}/${effectiveCategorySlug}/${cleanSlug}`
      : `/${effectiveCategorySlug}/${cleanSlug}`;

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic route path requires type assertion
    permanentRedirect(targetPath as any);
  }

  const urlPrefix = isLocalhost ? `/${slug}` : '';

  // Construct canonical URL:
  // 1. Use explicit canonical from product data if available
  // 2. OR build the base path using getProductUrl (which handles categories)
  let canonicalUrl = product.canonical_url;

  if (!canonicalUrl) {
    // Generate the correct path (e.g. /category/product or /products/product)
    const productPath = getProductUrl(product);

    // Construct full URL
    const basePath = `${baseUrl}${urlPrefix}${productPath}`;

    // Clean params for canonical
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

  // SEO: Enforce lowercase URLs using x-pathname header (works even if params are normalized)
  const headersList = await headers();
  const pathname = headersList.get('x-pathname');

  if (pathname && pathname !== pathname.toLowerCase()) {
    // biome-ignore lint/suspicious/noExplicitAny: Redirecting to lowercase string is valid
    return permanentRedirect(pathname.toLowerCase() as any);
  }

  const product = await getProductCached(slug, productSlug);

  if (!product) {
    notFound();
  }

  // Get cached merchant data for schema (handle custom domains)
  const merchant = slug.includes('.')
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  // Fetch cached review stats for AggregateRating schema
  const reviewStats = await getCachedProductRatingStats(product.id);

  // Fetch recent reviews for Review schema (SEO best practice)
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

  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Only include slug in URL path for localhost (development)
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const urlPrefix = isLocalhost ? `/${slug}` : '';

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    product,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG'
  );

  // Add URL to the schema offers (sanitized to prevent XSS)
  if (productSchema.offers && !Array.isArray(productSchema.offers)) {
    const productUrl = `${baseUrl}${urlPrefix}/products/${product.slug || product.id}`;
    productSchema.offers.url = escapeHtml(productUrl);
  }

  // Add AggregateRating if reviews exist
  if (reviewStats && reviewStats.totalReviews > 0) {
    const aggregateRating = generateAggregateRating({
      averageRating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
    });
    if (aggregateRating) {
      productSchema.aggregateRating = aggregateRating;
    }
  }

  // Generate breadcrumb schema using helper function (sanitization handled in generateBreadcrumbSchema)
  // FIXED: Use proper category path structure (/[category]/[slug]) instead of query params
  const productUrl = `${baseUrl}${urlPrefix}/${product.category_slug || 'products'}/${product.slug || product.id}`;

  const categorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : 'products');
  const categoryName =
    product.categories?.name || product.category || 'All Products';
  const categoryUrl = `${baseUrl}${urlPrefix}/${categorySlug}`;

  const breadcrumbItems = [
    { name: merchant?.business_name || 'Home', url: `${baseUrl}${urlPrefix}` },
    { name: categoryName, url: categoryUrl },
    { name: product.name, url: productUrl },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  // Generate FAQ schema if product has FAQs (2025 SEO best practice)
  // FAQs are stored in the product's faqs column as JSONB array
  const productFaqs = (product as unknown as { faqs?: FAQItem[] }).faqs;
  const faqSchema =
    productFaqs && productFaqs.length > 0
      ? generateFAQSchema(productFaqs)
      : null;

  return (
    <>
      {/* Product Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />

      {/* Breadcrumb Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />

      {/* FAQ Schema.org JSON-LD (2025 SEO best practice) */}
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
