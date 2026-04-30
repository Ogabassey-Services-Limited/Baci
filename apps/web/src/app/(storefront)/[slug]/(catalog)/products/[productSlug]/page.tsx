import { resolveVariantSelectionParamResolution } from '@baci/shared/lib';
import type { Metadata, ResolvingMetadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import {
  getCachedCategoryPageData,
  getCachedLegacyProductRedirectTarget,
  getCachedProduct,
  getCachedProductRatingStats,
  getCachedProductReviews,
  getCachedProductWithDetails,
  getRequestScopedMerchant,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import type { Product } from '@/lib/products';
import { asRoute } from '@/lib/routes';
import { escapeHtml } from '@/lib/sanitize-core';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  constructCanonicalUrl,
  generateAggregateRating,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateMetaDescription,
  generateMetaTitle,
  generateProductSchema,
  generateSlug,
  getIndexableRobotsMetadata,
  getProductUrl,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { normalizeStorefrontCanonicalUrl } from '@/lib/storefront-canonical-url';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';
import { getStorefrontProductSocialMetadata } from '@/lib/storefront-product-social-metadata';
import {
  DEFAULT_STORE_NAME,
  DEFAULT_STOREFRONT_SEO_CATEGORY,
} from '@/lib/storefront-seo-defaults';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { isValidMerchantIdentifier } from '@/lib/validation';
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

type ResolvedSearchParams = Awaited<PageProps['searchParams']>;

const LEGACY_SELECTION_PARAM_KEYS = new Set([
  'selectedoptions',
  'variant',
  'variantid',
  'variant_id',
]);

function normalizeSearchParamKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function appendSearchParamValue(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined
) {
  if (typeof value === 'string') {
    params.append(key, value);
    return;
  }

  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (typeof entry === 'string') {
      params.append(key, entry);
    }
  }
}

function buildRedirectSearchParams(searchParams: ResolvedSearchParams) {
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    appendSearchParamValue(nextParams, key, value);
  }

  return nextParams;
}

function buildSelectionSafeRedirectPath(
  storeSlug: string,
  product: Product,
  searchParams: ResolvedSearchParams,
  recognizedParamKeys: string[]
) {
  const targetPath = buildProductRedirectPath(
    storeSlug,
    getProductUrl(product)
  );
  const nextParams = buildRedirectSearchParams(searchParams);
  const removableKeys = new Set(
    recognizedParamKeys.map((key) => normalizeSearchParamKey(key))
  );

  for (const key of Array.from(nextParams.keys())) {
    const normalizedKey = normalizeSearchParamKey(key);
    if (
      removableKeys.has(normalizedKey) ||
      LEGACY_SELECTION_PARAM_KEYS.has(normalizedKey)
    ) {
      nextParams.delete(key);
    }
  }

  const queryString = nextParams.toString();
  return queryString ? `${targetPath}?${queryString}` : targetPath;
}

async function getProductCached(
  storeSlug: string,
  productSlug: string
): Promise<ProductLookupResult | null> {
  if (!isValidMerchantIdentifier(storeSlug)) {
    return null;
  }

  const safeStoreSlug = sanitizeLookupLogValue(storeSlug);
  const merchant = await getRequestScopedMerchant(storeSlug);
  if (!merchant) {
    console.warn(
      'Merchant not found for storefront product route:',
      safeStoreSlug
    );
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

// Returns the canonical redirect target if the URL is categorized but lives
// under /products/, else null. Pure — caller decides whether to throw a real
// redirect (page component) or emit noindex metadata (generateMetadata).
function getCategorizedRedirectTarget(
  storeSlug: string,
  product: Product
): string | null {
  const productPath = getProductUrl(product);
  if (productPath.startsWith('/products/')) {
    return null;
  }
  return buildProductRedirectPath(storeSlug, productPath);
}

// Returns the canonical redirect target when the URL's variant params are
// inconsistent (attribute-only, ambiguous, invalid id, zero-match). Pure —
// see getCategorizedRedirectTarget above for the rationale.
function getInvalidVariantSelectionRedirectTarget(
  storeSlug: string,
  product: Product,
  searchParams: ResolvedSearchParams
): string | null {
  if (!product.variants || product.variants.length === 0) {
    return null;
  }

  const selectionResolution = resolveVariantSelectionParamResolution(
    product,
    searchParams
  );

  if (
    selectionResolution.type === 'attribute_only' ||
    selectionResolution.type === 'ambiguous' ||
    selectionResolution.type === 'invalid_variant_id' ||
    selectionResolution.type === 'zero_match'
  ) {
    return buildSelectionSafeRedirectPath(
      storeSlug,
      product,
      searchParams,
      selectionResolution.extracted.recognizedParamKeys
    );
  }

  return null;
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
    // Don't issue a redirect from generateMetadata — Next.js can't change
    // HTTP status from here and falls back to an HTML <meta refresh>, which
    // Google indexes as a soft redirect / "noindex" page. The default page
    // component handler runs in parallel and throws permanentRedirect at the
    // pre-render stage, which produces a real HTTP 308. Returning bare,
    // noindex metadata here is a safety net for that race.
    void merchant;
    return { robots: { index: false, follow: false } };
  }
  // Mirror the page-component redirect checks so we can emit noindex metadata
  // (real HTTP 308 issues from the page render — see comment above).
  if (
    getCategorizedRedirectTarget(slug, product) ||
    getInvalidVariantSelectionRedirectTarget(
      slug,
      product,
      resolvedSearchParams
    )
  ) {
    return { robots: { index: false, follow: false } };
  }
  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  let canonicalUrl = normalizeStorefrontCanonicalUrl(
    product.canonical_url,
    baseUrl
  );
  if (!canonicalUrl) {
    const productPath = getProductUrl(product);
    const basePath = `${baseUrl}${productPath}`;
    canonicalUrl = constructCanonicalUrl(basePath, resolvedSearchParams, [
      'variant',
    ]);
  }
  // Metadata needs a generic noun here; the UI uses a friendlier "All Products"
  // fallback later for visible copy when no category label exists.
  const productCategoryName =
    product.categories?.name ||
    product.category ||
    DEFAULT_STOREFRONT_SEO_CATEGORY;
  const merchantDisplayName = merchant.business_name || DEFAULT_STORE_NAME;
  const seoDescription = generateMetaDescription(
    product.meta_description || product.description || '',
    160,
    {
      minLength: 110,
      fallback: `Buy ${product.name} from ${merchantDisplayName}. Shop verified ${productCategoryName} with delivery and flexible payment options.`,
    }
  );
  const socialMetadata = getStorefrontProductSocialMetadata(
    baseUrl,
    product,
    merchant.payout_currency || 'USD'
  );
  const metadataTitle = generateMetaTitle(
    product.meta_title || `${product.name} - ${productCategoryName}`,
    {
      maxLength: 70,
      suffix: merchantDisplayName,
      fallback: product.name || productCategoryName,
    }
  );
  const socialMedia = merchant.social_media as
    | Record<string, string>
    | undefined;
  return {
    title: metadataTitle,
    description: seoDescription,
    keywords: product.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: getIndexableRobotsMetadata(),
    openGraph: {
      title: metadataTitle,
      description: seoDescription,
      images: socialMetadata.openGraphImages,
      url: canonicalUrl,
      type: 'website',
      siteName: merchant.business_name,
    },
    twitter: {
      card: 'summary_large_image',
      title: metadataTitle,
      description: seoDescription,
      images: socialMetadata.twitterImages,
      ...(socialMedia?.twitter && {
        site: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
        creator: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
      }),
    },
    other: socialMetadata.other,
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
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
  const categorizedTarget = getCategorizedRedirectTarget(slug, product);
  if (categorizedTarget) {
    permanentRedirect(asRoute(categorizedTarget));
  }
  const invalidVariantTarget = getInvalidVariantSelectionRedirectTarget(
    slug,
    product,
    resolvedSearchParams
  );
  if (invalidVariantTarget) {
    redirect(asRoute(invalidVariantTarget));
  }
  const [reviewStats, recentReviews] = await Promise.all([
    getCachedProductRatingStats(product.id),
    getCachedProductReviews(product.id, { limit: 10 }),
  ]);
  // `product` comes from the request-scoped product cache. Mutating it in place
  // (as this did previously) would pollute the shared reference for subsequent
  // renders in the same request or across requests that replay the same cache
  // entry. Shallow-clone before attaching the per-request review payload.
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
  const productSchema = generateProductSchema(
    productWithReviews,
    merchant.business_name || 'Baci Store',
    merchant.payout_currency || 'USD',
    merchant.country || 'NG',
    merchant.logo_url,
    trustProfile
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
      <ProductDetailClient product={product} faqs={productFaqs} />
      <ProductSemanticSections model={semanticSectionsModel} />
    </>
  );
}
