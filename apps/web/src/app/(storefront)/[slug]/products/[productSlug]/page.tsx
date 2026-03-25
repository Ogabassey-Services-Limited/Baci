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
import { getEffectiveStock } from '@/lib/product-stock';
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
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import { isDomainIdentifier } from '@/lib/validation';
import type { FAQItem } from '@/types/faq';
import ProductDetailClient from './product-detail-client';

// This route mostly returns 308 redirects (categorized products) — PPR offers near-zero benefit.
// headers() below automatically opts this route into dynamic rendering under cacheComponents.

interface PageProps {
  params: Promise<{
    slug: string; // Store slug
    productSlug: string; // Product slug or ID
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type RawProductImage = string | { url: string; alt?: string; order?: number };
type StorefrontProductVariants = Parameters<
  typeof normalizeStorefrontProductVariants
>[0];

interface LegacyCachedProduct {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  slug?: string | null;
  sale_price?: number | null;
  base_price: number;
  track_quantity?: boolean | null;
  quantity?: number | null;
  images?: RawProductImage[] | null;
  product_variants?: StorefrontProductVariants;
  product_categories?: Array<{
    categories:
      | {
          id: string;
          name: string;
          slug: string;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
        }>
      | null;
  }> | null;
  specifications?: unknown;
  product_key_specs?: unknown;
}

interface DetailedCachedProduct {
  id: string;
  merchant_id?: string | null;
  name: string;
  description?: string | null;
  status?: string | null;
  slug?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  manage_stock?: boolean | null;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  images?: RawProductImage[] | null;
  imageHint?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  category?: string | null;
  categories?:
    | {
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
      }>
    | null;
  product_variants?: StorefrontProductVariants;
  specifications?: unknown;
  product_key_specs?: unknown;
}

function normalizeProductImages(
  productName: string,
  rawImages: RawProductImage[] | null | undefined
) {
  return rawImages?.map((img, idx) => {
    if (typeof img === 'string') {
      return { url: img, alt: productName, order: idx };
    }
    return {
      url: img.url,
      alt: img.alt || productName,
      order: img.order ?? idx,
    };
  });
}

function mapLegacyCachedProductToProduct(
  cachedProduct: LegacyCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = cachedProduct.product_categories?.[0]?.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    cachedProduct.name,
    cachedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    cachedProduct.product_variants,
    {
      merchantId,
      productId: cachedProduct.id,
    }
  );

  return {
    id: cachedProduct.id,
    name: cachedProduct.name,
    description: cachedProduct.description || '',
    status: cachedProduct.status as 'draft' | 'active' | 'archived',
    slug: cachedProduct.slug || cachedProduct.id,
    price: cachedProduct.sale_price || cachedProduct.base_price,
    compare_at_price: cachedProduct.sale_price
      ? cachedProduct.base_price
      : undefined,
    manage_stock: cachedProduct.track_quantity ?? false,
    stock: cachedProduct.quantity ?? 0,
    image: firstImage,
    imageLarge: firstImage,
    imageHint: cachedProduct.name,
    images: normalizedImages,
    brand: '',
    gtin: '',
    mpn: '',
    category: primaryCategory?.name || undefined,
    category_slug: primaryCategory?.slug || undefined,
    has_variants: normalizedVariants.length > 0,
    variants: normalizedVariants,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic JSON column from database
    specifications: cachedProduct.specifications as any,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic JSON column from database
    product_key_specs: cachedProduct.product_key_specs as any,
  };
}

function mapDetailedCachedProductToProduct(
  detailedProduct: DetailedCachedProduct,
  merchantId: string
): Product {
  const rawPrimaryCategory = detailedProduct.categories;
  const primaryCategory = Array.isArray(rawPrimaryCategory)
    ? rawPrimaryCategory[0]
    : rawPrimaryCategory;
  const normalizedImages = normalizeProductImages(
    detailedProduct.name,
    detailedProduct.images
  );
  const firstImage = normalizedImages?.[0]?.url || '';
  const normalizedVariants = normalizeStorefrontProductVariants(
    detailedProduct.product_variants,
    {
      merchantId: detailedProduct.merchant_id || merchantId,
      productId: detailedProduct.id,
    }
  );

  return {
    ...detailedProduct,
    description: detailedProduct.description || '',
    status: (detailedProduct.status || 'active') as
      | 'draft'
      | 'active'
      | 'archived',
    slug: detailedProduct.slug || detailedProduct.id,
    price:
      typeof detailedProduct.price === 'string'
        ? Number.parseFloat(detailedProduct.price) || 0
        : detailedProduct.price || 0,
    compare_at_price:
      typeof detailedProduct.compare_at_price === 'string'
        ? Number.parseFloat(detailedProduct.compare_at_price) || undefined
        : detailedProduct.compare_at_price || undefined,
    manage_stock: detailedProduct.manage_stock ?? true,
    stock: getEffectiveStock(detailedProduct),
    image: firstImage,
    imageLarge: firstImage,
    imageHint: detailedProduct.imageHint || detailedProduct.name,
    images: normalizedImages,
    brand: detailedProduct.brand || '',
    gtin: detailedProduct.gtin || '',
    mpn: detailedProduct.mpn || '',
    category: primaryCategory?.name || detailedProduct.category || undefined,
    category_slug:
      primaryCategory?.slug ||
      (detailedProduct.category
        ? generateSlug(detailedProduct.category)
        : undefined),
    has_variants: normalizedVariants.length > 0,
    variants: normalizedVariants,
  } as Product;
}

/**
 * Get product using cached data functions
 * Falls back to the detailed storefront query so legacy /products URLs can
 * still redirect to canonical category paths when the older projection misses.
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

  const cachedProduct = await getCachedProduct(merchant.id, productSlug);

  if (cachedProduct) {
    return mapLegacyCachedProductToProduct(cachedProduct, merchant.id);
  }

  let detailedProduct = await getCachedProductWithDetails(
    merchant.id,
    productSlug
  );

  if (!detailedProduct && productSlug !== productSlug.toLowerCase()) {
    detailedProduct = await getCachedProductWithDetails(
      merchant.id,
      productSlug.toLowerCase()
    );
  }

  if (!detailedProduct) {
    console.error('Product not found:', productSlug);
    return null;
  }

  return mapDetailedCachedProductToProduct(detailedProduct, merchant.id);
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

  const baseUrl = buildStoreUrl(
    merchant ??
      (isDomainIdentifier(slug)
        ? { slug, custom_domain: slug }
        : { slug, custom_domain: undefined })
  );

  // If we have a category slug (explicit or generated), REDIRECT to the pretty URL (SEO Best Practice)
  // This ensures /products/ URLs are always canonicalized to their category-based counterparts
  const effectiveCategorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : undefined);

  if (effectiveCategorySlug) {
    const cleanSlug = product.slug || product.id;
    // Detect routing mode from proxy headers (matches layout.tsx:192-200)
    const headersList = await headers();
    const isPathMode =
      !headersList.has('x-merchant-slug') &&
      !headersList.has('x-custom-domain') &&
      !isDomainIdentifier(slug);
    const targetPath = isPathMode
      ? `/${slug}/${effectiveCategorySlug}/${cleanSlug}`
      : `/${effectiveCategorySlug}/${cleanSlug}`;

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic route path requires type assertion
    permanentRedirect(targetPath as any);
  }

  // Construct canonical URL:
  // 1. Use explicit canonical from product data if available
  // 2. OR build the base path using getProductUrl (which handles categories)
  let canonicalUrl = product.canonical_url;

  if (!canonicalUrl) {
    // Generate the correct path (e.g. /category/product or /products/product)
    const productPath = getProductUrl(product);

    // Construct full URL
    const basePath = `${baseUrl}${productPath}`;

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

  const baseUrl = buildStoreUrl(
    merchant ??
      (isDomainIdentifier(slug)
        ? { slug, custom_domain: slug }
        : { slug, custom_domain: undefined })
  );

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    product,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG',
    merchant?.logo_url
  );

  // Canonical product URL used for both offers and breadcrumbs (consistent SEO signals)
  const productPath = getProductUrl(product);
  const productUrl = `${baseUrl}${productPath}`;

  // Add URL to the schema offers (sanitized to prevent XSS)
  // Variant products have no top-level offers (offers live on each hasVariant entry)
  if (
    productSchema.offers &&
    !Array.isArray(productSchema.offers) &&
    productSchema.offers['@type'] !== 'AggregateOffer'
  ) {
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
