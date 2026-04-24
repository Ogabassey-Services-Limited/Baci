import { resolveVariantSelectionParamResolution } from '@baci/shared/lib';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import type { ReactNode } from 'react';
import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client';
import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import { buildOgabasseyProductSpecData } from '@/components/storefront/ogabassey/product-spec-data';
import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import type { VariantAttributeSource } from '@/components/storefront/ogabassey/variant-attributes';
import {
  getRenderableVariantAxes,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from '@/components/storefront/ogabassey/variant-attributes';
import {
  type CachedLegacyProductRedirectTarget,
  type CachedMerchant,
  getCachedCategoryPageData,
  getCachedLegacyProductRedirectTarget,
  getCachedProductWithDetails,
  getRequestScopedMerchant,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { escapeHtml } from '@/lib/sanitize-core';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBreadcrumbSchema,
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
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import {
  DEFAULT_STORE_NAME,
  DEFAULT_STOREFRONT_SEO_CATEGORY,
} from '@/lib/storefront-seo-defaults';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { isValidMerchantIdentifier } from '@/lib/validation';

/**
 * Converts server-side Product to Ogabassey template format
 */
function toOgabasseyProduct(
  product: Product,
  currency = 'NGN'
): OgabasseyProduct {
  // Format price with currency symbol
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  });

  // Production data currently stores variant_attributes as either:
  // 1. a legacy object map { Storage: ['256GB'] }
  // 2. an array of { param: 'storage', options: ['256GB'] }
  // Normalize both shapes before building storefront selectors.
  const rawVariantAttributes = (product as { variant_attributes?: unknown })
    .variant_attributes as VariantAttributeSource;
  const normalizedVariantAttributes =
    normalizeVariantAttributes(rawVariantAttributes);
  const mergedVariantAxisOptions = mergeVariantAxisOptions(
    product.variants,
    rawVariantAttributes
  );
  const { detailedSpecs, specs } = buildOgabasseyProductSpecData({
    ...product,
    variant_attributes: normalizedVariantAttributes,
  });

  // Derive storage options - check multiple sources
  // Priority: explicit storage_options > normalized variant attributes > variants
  const storageOptions =
    product.storage_options && product.storage_options.length > 0
      ? product.storage_options
      : mergedVariantAxisOptions.storage || [];

  // Compute attributeAxes from both denormalized metadata and actual variants.
  // This keeps selectors visible even when variant rows are incomplete, while still
  // allowing public storefront queries to enrich pricing/availability once RLS permits them.
  const attributeAxes = getRenderableVariantAxes(
    product.variants,
    rawVariantAttributes
  );

  return {
    id: product.id,
    merchantId: product.merchant_id,
    slug: product.slug,
    name: product.name,
    price: formatter.format(product.price),
    rawPrice: product.price,
    image: product.imageLarge || product.image,
    // Handle both string arrays and object arrays with url property
    images:
      product.images?.map((img) => (typeof img === 'string' ? img : img.url)) ||
      [product.imageLarge || product.image].filter(Boolean),
    description: product.description,
    rating: product.rating ?? 0,
    // Use category from Product which is already resolved from join or TEXT field
    category: product.categories?.name || product.category || 'General',
    categorySlug: product.category_slug,
    condition: (product.condition || 'new') as OgabasseyProduct['condition'],
    brand: product.brand,
    stock: product.stock,
    // Storage options for variant selection UI
    storage: storageOptions,
    // Colors for variant selection UI
    colors: product.colors,
    // Consolidated variant attributes for Platform/etc selectors
    variant_attributes: normalizedVariantAttributes,
    // Dynamic variant axes for generic selector rendering
    attributeAxes: attributeAxes.length > 0 ? attributeAxes : undefined,
    detailedSpecs,
    specs,
    // Phase 4: Pass variants to frontend with mapping
    // Variants use attributes JSONB: {"storage": "128GB", "color": "Black", "platform": "EU"}
    variants:
      product.variants?.map(
        (v: {
          id: string;
          sku?: string;
          attributes?: Record<string, string>;
          price_override?: number;
          price_modifier?: number;
          stock_quantity?: number;
          images?: string[];
        }) => {
          const storage = v.attributes?.storage;
          const ram = v.attributes?.ram;
          const color = v.attributes?.color;
          const platform = v.attributes?.platform;

          return {
            id: v.id,
            name: `${storage || ''} ${ram || ''}`.trim() || v.sku || 'Variant',
            storage,
            ram,
            color,
            platform,
            attributes: v.attributes,
            price_override: v.price_override,
            price_modifier: v.price_modifier,
            stock: v.stock_quantity,
            images: v.images,
          };
        }
      ) || [],
    // Phase 5: Condition offers for consolidated products
    has_condition_offers: product.has_condition_offers,
    offers: product.offers?.map(
      (o: {
        id: string;
        condition: string;
        price: number | string;
        compare_at_price?: number | string | null;
        stock_quantity?: number;
        images?: string[];
        condition_notes?: string;
        grade?: string;
      }) => ({
        id: o.id,
        condition: o.condition as 'new' | 'open_box' | 'used',
        price: formatter.format(
          typeof o.price === 'string'
            ? Number.parseFloat(o.price) || 0
            : o.price
        ),
        rawPrice:
          typeof o.price === 'string'
            ? Number.parseFloat(o.price) || 0
            : o.price,
        compare_at_price: o.compare_at_price
          ? formatter.format(
              typeof o.compare_at_price === 'string'
                ? Number.parseFloat(o.compare_at_price) || 0
                : o.compare_at_price
            )
          : undefined,
        stock: o.stock_quantity,
        images: o.images,
        notes: o.condition_notes,
        grade: o.grade,
      })
    ),
  };
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

/**
 * Template-aware product page component
 * Renders the correct template's product page based on merchant's template_id
 */
function TemplateProductPage({
  product,
  templateId,
  semanticSections,
}: {
  product: Product;
  templateId?: string;
  semanticSections: ReactNode;
}) {
  // Ogabassey template
  if (templateId === 'ogabassey') {
    const ogabasseyProduct = toOgabasseyProduct(product);
    return (
      <OgabasseyProductPage
        product={ogabasseyProduct}
        semanticSections={semanticSections}
      />
    );
  }

  // Default: use the generic product detail client
  return (
    <>
      <ProductDetailClient product={product} />
      {semanticSections}
    </>
  );
}

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
    productSlug: string; // Product slug
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getRedirectTargetPath(
  storeSlug: string,
  product: {
    id: string;
    name: string;
    slug?: string;
    category?: string | null;
    categories?: { name?: string; slug?: string } | null;
    category_slug?: string;
  }
) {
  const productPath = getProductUrl(product);

  if (process.env.NODE_ENV === 'development') {
    return `/${storeSlug}${productPath}` as `/${string}`;
  }

  return productPath as `/${string}`;
}

function redirectInvalidVariantSelectionParams(
  storeSlug: string,
  product: Product,
  searchParams: Awaited<PageProps['searchParams']>
) {
  if (!product.variants || product.variants.length === 0) {
    return;
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
    permanentRedirect(getRedirectTargetPath(storeSlug, product));
  }
}

type CategoryProductResult =
  | {
      product: Product;
      categoryMismatch: boolean;
      merchant: CachedMerchant;
      needsValuesRedirect: boolean;
    }
  | {
      merchant: CachedMerchant;
      legacyRedirectTarget: CachedLegacyProductRedirectTarget;
    }
  | null;

const getProduct = async (
  storeSlug: string,
  categorySlug: string,
  productSlug: string
): Promise<CategoryProductResult> => {
  // 1. Get Merchant using request-scoped lookup so metadata/page/layout reuse the same request result.
  const merchant = await getRequestScopedMerchant(storeSlug);

  if (!merchant) {
    console.warn('Merchant not found for storefront product route:', storeSlug);
    return null;
  }

  // 2. Get Product using the new cached function with full joins
  let product = await getCachedProductWithDetails(merchant.id, productSlug);

  // 2b. Case-insensitive fallback: If not found, try lowercasing the productSlug
  // This handles Google index errors like google-pixel-6-8GB-256GB vs google-pixel-6-8gb-256gb
  let needsValuesRedirect = false;
  if (!product && productSlug !== productSlug.toLowerCase()) {
    const lowercaseSlug = productSlug.toLowerCase();
    product = await getCachedProductWithDetails(merchant.id, lowercaseSlug);
    if (product) {
      needsValuesRedirect = true;
    }
  }

  if (!product) {
    const legacyRedirectTarget = await getCachedLegacyProductRedirectTarget(
      merchant.id,
      productSlug
    );

    if (legacyRedirectTarget) {
      return {
        merchant,
        legacyRedirectTarget,
      };
    }

    console.warn(
      'Product not found for storefront product route:',
      sanitizeLookupLogValue(productSlug)
    );
    return null;
  }

  // 3. Process category data
  interface ProductWithCategory {
    categories?: {
      id: string;
      name: string;
      slug: string;
      parent_id?: string;
    } | null;
  }
  const productWithCat = product as unknown as ProductWithCategory;
  const joinedCategory = productWithCat.categories;

  const dbCategorySlug = joinedCategory?.slug;
  const dbCategoryName = joinedCategory?.name || product.category;

  // Normalize the images array from the database (JSON column stored as string or object array).
  // Guard against both non-array values and empty arrays so primaryImage always resolves.
  const rawImages = Array.isArray(product.images)
    ? (product.images as Array<string | { url: string; alt?: string }>)
    : [];
  const normalizedImages = rawImages.map((image, index) =>
    typeof image === 'string'
      ? { url: image, alt: product.name, order: index }
      : {
          url: image.url,
          alt: image.alt || product.name,
          order: index,
        }
  );
  const primaryImage = normalizedImages[0]?.url || '/placeholder.png';
  const rawVariantAttributes = (product as { variant_attributes?: unknown })
    .variant_attributes as VariantAttributeSource;
  const normalizedVariantAttributes =
    normalizeVariantAttributes(rawVariantAttributes);

  // Create extended product with category info.
  // Default `manage_stock` to `true` so legacy rows with `null` are treated as
  // managed inventory. Treating missing values as `false` would make
  // `generateProductSchema` advertise them as `InStock` regardless of actual
  // stock, which regresses historical data. See seo-utils
  // `getProductAvailability` — `manage_stock === false` short-circuits to
  // InStock.
  const manageStock = product.manage_stock ?? true;

  const productWithCategorySlug: Product = {
    ...product,
    product_key_specs:
      product.product_key_specs as unknown as Product['product_key_specs'],
    description: product.description || '',
    price:
      typeof product.price === 'string'
        ? Number.parseFloat(product.price) || 0
        : product.price,
    compare_at_price:
      typeof product.compare_at_price === 'string'
        ? Number.parseFloat(product.compare_at_price) || undefined
        : product.compare_at_price,
    manage_stock: manageStock,
    stock: getEffectiveStock(product),
    image: primaryImage,
    imageLarge: primaryImage,
    imageHint: product.imageHint || product.name,
    images: normalizedImages,
    variant_attributes: normalizedVariantAttributes,
    fulfillmentFields: product.fulfillmentFields || [],
    category: dbCategoryName || product.category,
    category_slug: dbCategorySlug,
    // Filter offers to exclude main product condition
    offers: product.product_offers?.filter(
      (o: { condition: string; status: string }) =>
        o.condition !== product.condition && o.status === 'active'
    ),
    // Map variants
    variants: normalizeStorefrontProductVariants(product.product_variants, {
      merchantId: product.merchant_id || merchant.id,
      productId: product.id,
    }),
  } as Product;

  const productCategorySlug =
    dbCategorySlug ||
    (product.category ? generateSlug(product.category) : null);

  // Compare normalized slugs so alias remaps (e.g. samsung -> smartphones) don't
  // trigger a redirect loop between the canonical URL and the raw DB slug.
  const normalizedProductCategorySlug =
    normalizeStorefrontCategorySlug(productCategorySlug);
  const normalizedUrlCategorySlug =
    normalizeStorefrontCategorySlug(categorySlug);
  const categoryMismatch = Boolean(
    normalizedProductCategorySlug &&
      normalizedProductCategorySlug !== normalizedUrlCategorySlug
  );

  return {
    product: productWithCategorySlug,
    categoryMismatch,
    merchant,
    needsValuesRedirect,
  };
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug, category, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const result = await getProduct(slug, category, productSlug);

  if (!result) {
    notFound();
  }

  if (!('product' in result)) {
    permanentRedirect(getRedirectTargetPath(slug, result.legacyRedirectTarget));
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } = result;

  // Redirect before metadata is emitted so crawlers receive a real HTTP 308
  // instead of Next.js's streamed meta-refresh fallback.
  if (categoryMismatch || needsValuesRedirect) {
    permanentRedirect(getRedirectTargetPath(slug, product));
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  redirectInvalidVariantSelectionParams(slug, product, resolvedSearchParams);

  // Construct canonical URL:
  // 1. Use explicit canonical from product data if available AND it matches
  //    the final PDP path (otherwise the canonical would itself redirect).
  // 2. OR build the base path using getProductUrl (which handles categories).
  const finalProductPath = getProductUrl({
    ...product,
    canonical_url: null,
  });
  let canonicalUrl = normalizeStorefrontCanonicalUrl(
    product.canonical_url,
    baseUrl,
    merchant.slug
  );

  if (canonicalUrl) {
    try {
      const canonicalPath =
        new URL(canonicalUrl).pathname.replace(/\/+$/, '') || '/';
      const normalizedFinalPath = finalProductPath.replace(/\/+$/, '') || '/';
      if (canonicalPath !== normalizedFinalPath) {
        canonicalUrl = undefined;
      }
    } catch {
      canonicalUrl = undefined;
    }
  }

  if (!canonicalUrl) {
    canonicalUrl = `${baseUrl}${finalProductPath}`;
  }
  const productCategoryName =
    product.categories?.name ||
    product.category ||
    DEFAULT_STOREFRONT_SEO_CATEGORY;
  const merchantDisplayName = merchant?.business_name || DEFAULT_STORE_NAME;
  const seoDescription = generateMetaDescription(
    product.meta_description || product.description || '',
    160,
    {
      minLength: 110,
      fallback: `Buy ${product.name} from ${merchantDisplayName}. Shop trusted ${productCategoryName} with delivery and flexible payment options.`,
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

  const socialMedia = merchant?.social_media as
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
      siteName: merchant?.business_name,
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

export default async function CategoryProductPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, category, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const result = await getProduct(slug, category, productSlug);

  if (!result) {
    notFound();
  }

  if (!('product' in result)) {
    permanentRedirect(getRedirectTargetPath(slug, result.legacyRedirectTarget));
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } = result;

  // Strict Canonical URL Enforcement:
  // 1. If we found via case-insensitive fallback -> Redirect to lowercase canonical
  // 2. If the URL category doesn't match the product's actual category -> Redirect
  if (categoryMismatch || needsValuesRedirect) {
    permanentRedirect(getRedirectTargetPath(slug, product));
  }

  redirectInvalidVariantSelectionParams(slug, product, resolvedSearchParams);
  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const resolvedCategorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : 'products');
  const categoryPageData = await getCachedCategoryPageData(
    merchant.id,
    resolvedCategorySlug,
    slug
  );
  const guidePosts = await getPublishedClusterPosts(merchant.id);
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const inventoryCandidates = (
    categoryPageData?.isCollection ? [] : (categoryPageData?.products ?? [])
  ).map((candidate) => {
    const productCandidate = candidate as {
      slug: string;
      name: string;
      brand?: string | null;
      condition?: string | null;
      price: number;
      stock?: number | null;
      category_slug?: string | null;
      product_key_specs?: Record<string, unknown> | null;
    };

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
    merchantBusinessName: merchant?.business_name || 'Baci Store',
    categorySlug: resolvedCategorySlug,
    categoryName: product.category || 'All Products',
    currentProduct: {
      slug: product.slug || String(product.id),
      name: product.name,
      brand: product.brand,
      condition: product.condition,
      price: product.price,
      stock: product.stock,
      category_slug: product.category_slug ?? resolvedCategorySlug,
      product_key_specs: product.product_key_specs,
    },
    inventory: inventoryCandidates,
    guidePosts,
  });
  const semanticSections = (
    <ProductSemanticSections
      model={{
        ...semanticModel,
        trustBullets: [
          ...buildTrustBulletsFromProfile(trustProfile),
          ...semanticModel.trustBullets,
        ],
      }}
    />
  );
  const derivedSpecData = buildOgabasseyProductSpecData(product);
  const schemaProduct =
    derivedSpecData.detailedSpecs.length > 0
      ? {
          ...product,
          specifications: derivedSpecData.detailedSpecs,
        }
      : product;

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    schemaProduct,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG',
    merchant?.logo_url,
    trustProfile
  );

  // Build proper URL for schema
  const productPath = getProductUrl(product);
  const productUrl = `${baseUrl}${productPath}`;

  // Set URL on offers — variant products have no top-level offers (each hasVariant entry has its own)
  if (
    productSchema.offers &&
    !Array.isArray(productSchema.offers) &&
    productSchema.offers['@type'] !== 'AggregateOffer'
  ) {
    productSchema.offers.url = escapeHtml(productUrl);
  }

  // Generate breadcrumb schema with category
  // Use category_slug from product if available, otherwise generate from TEXT field
  const categorySlugForUrl =
    product.categories?.slug ||
    product.category_slug ||
    (product.category ? generateSlug(product.category) : null);

  const categoryUrl = categorySlugForUrl
    ? `${baseUrl}/${categorySlugForUrl}`
    : `${baseUrl}/products`;

  const breadcrumbItems = [
    { name: merchant?.business_name || 'Home', url: baseUrl },
    { name: product.category || 'All Products', url: categoryUrl },
    { name: product.name, url: productUrl },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  return (
    <>
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }}
      />
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }} // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />
      {/* Hidden crawlable summary without a second page-level heading */}
      <article className="sr-only" aria-label={`${product.name} summary`}>
        <p>
          {product.description ||
            `Buy ${product.name} at the best price in Nigeria. Pay later with flexible options.`}
        </p>
        <dl>
          <dt>Brand</dt>
          <dd>{product.brand || 'OgaBassey'}</dd>
          <dt>Category</dt>
          <dd>{product.category || 'Electronics'}</dd>
          <dt>Condition</dt>
          <dd>{product.condition || 'New'}</dd>
          <dt>Price</dt>
          <dd>₦{product.price?.toLocaleString() || 'Contact for price'}</dd>
        </dl>
      </article>
      <TemplateProductPage
        product={product}
        semanticSections={semanticSections}
        templateId={merchant?.template_id}
      />
    </>
  );
}
