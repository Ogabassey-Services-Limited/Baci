import type { Metadata, ResolvingMetadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
  getCachedMerchant,
  getCachedProduct,
  getCachedProductRatingStats,
} from '@/lib/cached-data';
import type { Product } from '@/lib/products';
import { escapeHtml, safeJsonLdStringify } from '@/lib/sanitize-core';
import {
  constructCanonicalUrl,
  generateAggregateRating,
  generateBreadcrumbSchema,
  generateProductSchema,
  getProductUrl,
} from '@/lib/seo-utils';
import ProductDetailClient from './product-detail-client';

// Enable ISR (Incremental Static Regeneration) with 5 minute revalidation
// Pages will be statically generated on-demand and cached for 5 minutes
export const revalidate = 300; // Revalidate every 5 minutes (300 seconds)

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
  // Get merchant first to get the merchant ID
  const merchant = await getCachedMerchant(storeSlug);

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
        attributes: v.options || {},
        stock_quantity: v.stock ?? 0,
        price_override: v.price_modifier,
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
    };
  }

  // Get cached merchant data
  const merchant = await getCachedMerchant(slug);

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Only include slug in URL path for localhost (development)
  // For subdomains (merchant.usebaci.com) and custom domains (merchant.com),
  // the merchant identity is in the domain itself, not the path
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // If we have a category slug, REDIRECT to the pretty URL (SEO Best Practice)
  // This answers: "should the /products/ link still exist?" -> No, it redirects.
  if (product.category_slug) {
    const cleanSlug = product.slug || product.id;
    // Resolve stored slug (localhost/preview logic vs production subdomain logic)
    const targetPath = isLocalhost
      ? `/${slug}/${product.category_slug}/${cleanSlug}`
      : `/${product.category_slug}/${cleanSlug}`;

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
    description: product.meta_description || product.description,
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

  // Get cached merchant data for schema
  const merchant = await getCachedMerchant(slug);

  // Fetch cached review stats for AggregateRating schema
  const reviewStats = await getCachedProductRatingStats(product.id);

  const headersList = await headers();
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
    merchant?.payout_currency || 'USD'
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
  const productUrl = `${baseUrl}${urlPrefix}/products/${product.slug || product.id}`;
  const categoryUrl = product.category
    ? `${baseUrl}${urlPrefix}/products?category=${encodeURIComponent(product.category)}`
    : `${baseUrl}${urlPrefix}/products`;

  const breadcrumbItems = [
    { name: merchant?.business_name || 'Home', url: `${baseUrl}${urlPrefix}` },
    { name: product.category || 'All Products', url: categoryUrl },
    { name: product.name, url: productUrl },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

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

      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailClient product={product} />
      </Suspense>
    </>
  );
}
