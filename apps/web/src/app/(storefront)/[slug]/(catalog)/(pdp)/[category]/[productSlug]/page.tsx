import '@/app/(storefront)/storefront-pdp-critical.css';
import { resolveVariantSelectionParamResolution } from '@baci/shared/lib';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { getStorefrontShellSnapshotBase } from '@/app/(storefront)/[slug]/storefront-shell-snapshot';
import { OgabasseyPdpProductLcpSkeleton } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-lcp-skeleton';
import { preloadOgabasseyPdpProductResources } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints';
import { OgabasseyPdpBelowFoldIsland } from '@/components/storefront/ogabassey/pdp/client-islands';
import { createCriticalCartProduct } from '@/components/storefront/ogabassey/pdp/critical-cart-product';
import { OgabasseyPdpCriticalCommerce } from '@/components/storefront/ogabassey/pdp/critical-commerce';
import {
  OgabasseyPdpCriticalCommerceProvider,
  OgabasseyPdpCriticalCommerceSummary,
} from '@/components/storefront/ogabassey/pdp/critical-commerce.client';
import { buildOgabasseyPdpCriticalProduct } from '@/components/storefront/ogabassey/pdp/critical-product';
import { OgabasseyPdpCriticalShell } from '@/components/storefront/ogabassey/pdp/critical-shell';
import { buildOgabasseyProductSpecData } from '@/components/storefront/ogabassey/product-spec-data';
import {
  normalizeProductCondition,
  type Product as OgabasseyProduct,
} from '@/components/storefront/ogabassey/types';
import type { VariantAttributeSource } from '@/components/storefront/ogabassey/variant-attributes';
import {
  getRenderableVariantAxes,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from '@/components/storefront/ogabassey/variant-attributes';
import { OGABASSEY_DOMAIN, OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import {
  type CachedLegacyProductRedirectTarget,
  type CachedMerchant,
  type CachedProductLcpHint,
  getCachedLegacyProductRedirectTarget,
  getCachedProductLcpHint,
  getCachedProductWithDetails,
  getRequestScopedMerchant,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from '@/lib/cached-product-lcp-hint-primary-image';
import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';
import { isKorapayConfigured } from '@/lib/korapay';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';
import { getKnownOgaBasseyMerchantId } from '@/lib/ogabassey-route-identity';
import { isPaystackConfigured } from '@/lib/paystack';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product, ProductCondition } from '@/lib/products';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  buildStorefrontAcceptedPaymentMethods,
  generateBreadcrumbSchema,
  generateMetaDescription,
  generateMetaTitle,
  generateProductSchema,
  generateSlug,
  getIndexableRobotsMetadata,
  getProductUrl,
  getValidatedProductUrl,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { stripVolatileProductPriceSentences } from '@/lib/storefront-product-description';
import { buildProductPriceSeoCopy } from '@/lib/storefront-product-price-seo';
import { getStorefrontProductSocialMetadata } from '@/lib/storefront-product-social-metadata';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import {
  DEFAULT_STORE_NAME,
  DEFAULT_STOREFRONT_SEO_CATEGORY,
} from '@/lib/storefront-seo-defaults';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import { OgabasseyPdpSemanticSections } from './ogabassey-pdp-semantic-sections';

const CANONICAL_PRODUCT_REDIRECT_METADATA: Metadata = {
  // Replace root metadata alternates so noindex fallback pages do not inherit a canonical.
  alternates: null,
  robots: { index: false, follow: true },
};

const priceFormatterCache = new Map<string, Intl.NumberFormat>();

function getPriceFormatter(currency: string): Intl.NumberFormat {
  let formatter = priceFormatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    });
    priceFormatterCache.set(currency, formatter);
  }
  return formatter;
}

/**
 * Converts server-side Product to Ogabassey template format
 */
function toOgabasseyProduct(
  product: Product,
  currency = 'NGN'
): OgabasseyProduct {
  // Format price with currency symbol
  const formatter = getPriceFormatter(currency);

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
    rawVariantAttributes,
    product.condition
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
    rawVariantAttributes,
    product.condition
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
    manage_stock: product.manage_stock,
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
          condition?: string | null;
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
            condition: normalizeProductCondition(v.condition),
            platform,
            attributes: v.attributes,
            price_override: v.price_override,
            price_modifier: v.price_modifier,
            // Keep legacy `stock` and canonical `stock_quantity` consumers in sync.
            stock: v.stock_quantity,
            stock_quantity: v.stock_quantity,
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

function getFirstViewportVariantAxes(
  variants: Product['variants'],
  variantAttributes: VariantAttributeSource,
  condition?: Product['condition']
) {
  return getRenderableVariantAxes(variants, variantAttributes, condition);
}

type TemplateProductRenderMode = 'full' | 'belowFold';

/**
 * Template-aware product page component
 * Renders the correct template's product page based on merchant's template_id
 */
async function renderTemplateProductPage({
  product,
  templateId,
  semanticSections,
}: {
  product: Product;
  renderMode?: TemplateProductRenderMode;
  templateId?: string;
  semanticSections: ReactNode;
}) {
  // Ogabassey template
  if (templateId === OGABASSEY_TEMPLATE_ID) {
    const ogabasseyProduct = toOgabasseyProduct(product);

    return (
      <OgabasseyPdpBelowFoldIsland
        product={ogabasseyProduct}
        semanticSections={semanticSections}
      />
    );
  }

  const { DefaultProductPageRenderer } = await import(
    './default-product-page-renderer'
  );

  return (
    <DefaultProductPageRenderer
      product={product}
      semanticSections={semanticSections}
    />
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

function getCategoryProductBasePath(slug: string): '' | `/${string}` {
  return isDomainIdentifier(slug) ? '' : `/${slug}`;
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
  return `${getCategoryProductBasePath(storeSlug)}${productPath}` as `/${string}`;
}

function redirectInvalidVariantSelectionParams(
  storeSlug: string,
  product: Product,
  searchParams: Awaited<PageProps['searchParams']>
) {
  if (shouldRedirectVariantSelectionParams(product, searchParams)) {
    permanentRedirect(getRedirectTargetPath(storeSlug, product));
  }
}

function shouldRedirectVariantSelectionParams(
  product: Product,
  searchParams: Awaited<PageProps['searchParams']>
) {
  if (!product.variants || product.variants.length === 0) {
    return false;
  }

  const selectionResolution = resolveVariantSelectionParamResolution(
    product,
    searchParams
  );

  return (
    selectionResolution.type === 'attribute_only' ||
    selectionResolution.type === 'ambiguous' ||
    selectionResolution.type === 'invalid_variant_id' ||
    selectionResolution.type === 'zero_match'
  );
}

function getInitialCriticalVariantSelection(
  product: Product,
  searchParams: Awaited<PageProps['searchParams']>
) {
  if (!product.variants || product.variants.length === 0) {
    return undefined;
  }

  const selectionResolution = resolveVariantSelectionParamResolution(
    product,
    searchParams
  );

  if (selectionResolution.type === 'none') {
    return getDefaultCriticalVariantSelection(product);
  }

  const [match] = selectionResolution.matches;
  const attributes =
    selectionResolution.type === 'variant_id'
      ? match?.attributes
      : selectionResolution.type === 'condition_with_attributes' ||
          selectionResolution.type === 'attribute_only'
        ? selectionResolution.selectionInput.attributes
        : undefined;
  const condition =
    selectionResolution.selectionInput.condition ||
    match?.condition ||
    undefined;
  const variantId =
    selectionResolution.type === 'variant_id'
      ? selectionResolution.selectionInput.variantId
      : undefined;

  if (!attributes && !condition && !variantId) {
    return undefined;
  }

  return {
    ...(attributes && { attributes }),
    ...(condition && { condition }),
    ...(variantId && { variantId }),
  };
}

function getDefaultCriticalVariantSelection(product: Product) {
  const productColor = normalizeRouteSelectionValue(product.color);
  const productCondition = normalizeProductCondition(product.condition);
  const defaultVariantId = normalizeRouteSelectionValue(
    product.default_variant_id
  );
  const defaultVariant = defaultVariantId
    ? product.variants?.find((variant) => variant.id === defaultVariantId)
    : undefined;
  const attributes = productColor
    ? { color: productColor }
    : defaultVariant?.attributes;
  const condition =
    (productColor ? productCondition : defaultVariant?.condition) ||
    productCondition;
  const variantId = productColor ? undefined : defaultVariant?.id;

  if (!attributes && !condition && !variantId) {
    return undefined;
  }

  return {
    ...(attributes && { attributes }),
    ...(condition && { condition }),
    ...(variantId && { variantId }),
  };
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

interface LcpRouteProduct {
  base_price?: number | null;
  brand: string;
  canonical_url?: string;
  categories?: { name?: string; slug?: string } | null;
  category?: string;
  category_slug?: string;
  color?: string;
  condition?: ProductCondition;
  compare_at_price?: number;
  default_variant_id?: string;
  description: string;
  gtin: string;
  has_variants?: boolean;
  id: string;
  image: string;
  imageHint: string;
  imageLarge: string;
  keywords?: string[];
  manage_stock: boolean;
  max_variant_price?: number;
  meta_description?: string;
  meta_title?: string;
  min_variant_price?: number;
  mpn: string;
  name: string;
  offers?: Array<{
    id: string;
    condition: ProductCondition;
    price: number;
    status?: string | null;
    stock_quantity: number;
  }>;
  price?: number | null;
  sale_price?: number | null;
  schema_markup?: Product['schema_markup'];
  slug?: string;
  status: Product['status'];
  stock: number;
  stock_quantity?: number | null;
  updated_at?: string | null;
  variant_attributes?: unknown;
  variants?: Product['variants'];
}

type CategoryProductRouteControlResult =
  | {
      product: LcpRouteProduct;
      categoryMismatch: boolean;
      merchant: CachedMerchant;
      needsValuesRedirect: boolean;
    }
  | {
      merchant: CachedMerchant;
      legacyRedirectTarget: CachedLegacyProductRedirectTarget;
    };

interface CategoryProductRouteControl {
  result: CategoryProductRouteControlResult;
  loadProductResult: () => Promise<CategoryProductResult>;
  preloadedProductResourceKey?: string | null;
}

function hasCategoryMismatch(
  productCategorySlug: string | null | undefined,
  urlCategorySlug: string
) {
  const normalizedProductCategorySlug =
    normalizeStorefrontCategorySlug(productCategorySlug);
  const normalizedUrlCategorySlug =
    normalizeStorefrontCategorySlug(urlCategorySlug);

  return Boolean(
    normalizedProductCategorySlug &&
      normalizedProductCategorySlug !== normalizedUrlCategorySlug
  );
}

function getMappedProductCategorySlug(product: LcpRouteProduct) {
  return (
    product.category_slug ||
    (product.category ? generateSlug(product.category) : null)
  );
}

function isUuidProductRouteValue(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function shouldRedirectResolvedProductSlugValue(
  productSlug: string,
  resolvedSlug: string | null | undefined
) {
  return (
    !isUuidProductRouteValue(productSlug) &&
    Boolean(resolvedSlug) &&
    resolvedSlug !== productSlug &&
    resolvedSlug?.toLowerCase() === productSlug.toLowerCase()
  );
}

function getDirectProductPreloadKey(src: string): string {
  return `direct:${src}`;
}

function parseRouteProductNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getLcpRouteLegacyPrices(cachedProduct: CachedProductLcpHint) {
  const price = parseRouteProductNumber(cachedProduct.price);
  const compareAtPrice = parseRouteProductNumber(
    cachedProduct.compare_at_price
  );
  const hasSale =
    price !== null && compareAtPrice !== null && compareAtPrice > price;

  return {
    basePrice: hasSale ? compareAtPrice : (price ?? compareAtPrice),
    compareAtPrice,
    price: price ?? compareAtPrice,
    salePrice: hasSale ? price : null,
  };
}

function normalizeRouteSelectionValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRouteSelectionKey(value: string | null | undefined) {
  return normalizeRouteSelectionValue(value).toLowerCase();
}

function getVariantPrimaryImage(
  variant: NonNullable<Product['variants']>[number] | null | undefined
) {
  if (!variant || typeof variant !== 'object') {
    return null;
  }

  return variant.primary_image || variant.images?.[0] || null;
}

function getInitialRouteVariant(
  cachedProduct: CachedProductLcpHint,
  variants: NonNullable<Product['variants']>
) {
  const productColor = normalizeRouteSelectionValue(cachedProduct.color);
  const productColorKey = normalizeRouteSelectionKey(cachedProduct.color);
  const productCondition = normalizeProductCondition(cachedProduct.condition);
  const defaultVariantId = normalizeRouteSelectionValue(
    cachedProduct.default_variant_id
  );
  const sameProductColorVariants = productColor
    ? variants.filter(
        (variant) =>
          normalizeRouteSelectionKey(variant.attributes?.color) ===
          productColorKey
      )
    : [];
  const productColorAndConditionVariant = sameProductColorVariants.find(
    (variant) =>
      !productCondition ||
      (variant.condition ?? productCondition) === productCondition
  );

  return (
    productColorAndConditionVariant ||
    sameProductColorVariants[0] ||
    variants.find((variant) => variant.id === defaultVariantId) ||
    null
  );
}

function mapCachedProductLcpHintToRouteProduct(
  cachedProduct: CachedProductLcpHint
): LcpRouteProduct {
  const rawCanonicalCategory = cachedProduct.categories;
  const canonicalCategory = Array.isArray(rawCanonicalCategory)
    ? rawCanonicalCategory[0]
    : rawCanonicalCategory;
  const rawFallbackCategory = cachedProduct.product_categories?.[0]?.categories;
  const fallbackCategory = Array.isArray(rawFallbackCategory)
    ? rawFallbackCategory[0]
    : rawFallbackCategory;
  const primaryCategory = canonicalCategory ?? fallbackCategory;
  const legacyPrices = getLcpRouteLegacyPrices(cachedProduct);
  const manageStock = cachedProduct.manage_stock ?? true;
  const effectiveStock = getEffectiveStock(cachedProduct);
  const canUseDenormalizedVariantPrices = manageStock === false;
  const variants = normalizeStorefrontProductVariants(
    cachedProduct.product_variants,
    {
      merchantId: cachedProduct.merchant_id || OGABASSEY_MERCHANT_ID,
      productId: cachedProduct.id,
    }
  );
  const initialVariant = getInitialRouteVariant(cachedProduct, variants);
  const primaryImage =
    getVariantPrimaryImage(initialVariant) ||
    getCachedProductLcpHintPrimaryImage(cachedProduct) ||
    '';

  return {
    base_price: legacyPrices.basePrice,
    brand: cachedProduct.brand ?? '',
    canonical_url: cachedProduct.canonical_url ?? undefined,
    categories: primaryCategory,
    category: primaryCategory?.name ?? cachedProduct.category ?? undefined,
    category_slug: primaryCategory?.slug,
    color: cachedProduct.color ?? undefined,
    condition: normalizeProductCondition(cachedProduct.condition),
    compare_at_price: legacyPrices.compareAtPrice ?? undefined,
    default_variant_id: cachedProduct.default_variant_id ?? undefined,
    description: cachedProduct.meta_description ?? '',
    gtin: '',
    has_variants: Boolean(cachedProduct.has_variants) || variants.length > 0,
    id: cachedProduct.id,
    keywords: cachedProduct.keywords ?? undefined,
    image: primaryImage,
    imageHint: cachedProduct.name,
    imageLarge: primaryImage,
    manage_stock: manageStock,
    max_variant_price: canUseDenormalizedVariantPrices
      ? (parseRouteProductNumber(cachedProduct.max_variant_price) ?? undefined)
      : undefined,
    meta_description: cachedProduct.meta_description ?? undefined,
    meta_title: cachedProduct.meta_title ?? undefined,
    min_variant_price: canUseDenormalizedVariantPrices
      ? (parseRouteProductNumber(cachedProduct.min_variant_price) ?? undefined)
      : undefined,
    mpn: '',
    name: cachedProduct.name,
    price: legacyPrices.price,
    sale_price: legacyPrices.salePrice,
    schema_markup: cachedProduct.schema_markup as Product['schema_markup'],
    slug: cachedProduct.slug ?? cachedProduct.id,
    status: 'active',
    stock: effectiveStock,
    stock_quantity: effectiveStock,
    updated_at: cachedProduct.updated_at,
    variant_attributes: cachedProduct.variant_attributes,
    variants,
  };
}

function buildCriticalCommerceRouteProduct(product: LcpRouteProduct): Product {
  return {
    ...product,
    compare_at_price: product.compare_at_price ?? undefined,
    description: stripVolatileProductPriceSentences(product.description),
    max_variant_price: product.max_variant_price ?? undefined,
    min_variant_price: product.min_variant_price ?? undefined,
    price: product.price ?? 0,
  };
}

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

  return getProductForMerchant(merchant, categorySlug, productSlug);
};

const getProductForMerchant = async (
  merchant: CachedMerchant,
  categorySlug: string,
  productSlug: string
): Promise<CategoryProductResult> => {
  // 2. Get Product using the new cached function with full joins
  let product = await getCachedProductWithDetails(merchant.id, productSlug);

  // 2b. Case-insensitive fallback: If not found, try lowercasing the productSlug
  // This handles Google index errors like google-pixel-6-8GB-256GB vs google-pixel-6-8gb-256gb
  let needsValuesRedirect = false;
  if (!product && productSlug !== productSlug.toLowerCase()) {
    const lowercaseSlug = productSlug.toLowerCase();
    product = await getCachedProductWithDetails(merchant.id, lowercaseSlug);
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

    return null;
  }

  needsValuesRedirect = shouldRedirectResolvedProductSlugValue(
    productSlug,
    product.slug
  );

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
  } as unknown as Product;

  const productCategorySlug =
    dbCategorySlug ||
    (product.category ? generateSlug(product.category) : null);

  // Compare normalized slugs so alias remaps (e.g. samsung -> smartphones) don't
  // trigger a redirect loop between the canonical URL and the raw DB slug.
  const categoryMismatch = hasCategoryMismatch(
    productCategorySlug,
    categorySlug
  );

  return {
    product: productWithCategorySlug,
    categoryMismatch,
    merchant,
    needsValuesRedirect,
  };
};

async function getProductRouteControl(
  storeSlug: string,
  categorySlug: string,
  productSlug: string
): Promise<CategoryProductRouteControl | null> {
  const knownOgaBasseyMerchantId = getKnownOgaBasseyMerchantId(storeSlug);
  const isKnownOgaBasseyCustomDomain =
    storeSlug.trim().toLowerCase() === OGABASSEY_DOMAIN.toLowerCase();
  let preloadedProductResourceKey: string | null = null;
  const knownOgaBasseyImageLcpHintPromise = knownOgaBasseyMerchantId
    ? getCachedProductLcpHint(knownOgaBasseyMerchantId, productSlug, {
        includeVariants: false,
      })
    : null;
  if (knownOgaBasseyImageLcpHintPromise) {
    void knownOgaBasseyImageLcpHintPromise.catch((error) => {
      console.warn(
        'Unable to prewarm OgaBassey PDP LCP hint:',
        sanitizeLookupLogValue(productSlug),
        error
      );
    });
  }

  const merchantPromise = getRequestScopedMerchant(storeSlug);

  if (knownOgaBasseyImageLcpHintPromise && isKnownOgaBasseyCustomDomain) {
    const earlyPreloadResult = await Promise.race([
      knownOgaBasseyImageLcpHintPromise
        .then((cachedProduct) => ({
          cachedProduct,
          kind: 'lcp-hint' as const,
          primaryImage: getCachedProductLcpHintPrimaryImage(cachedProduct),
        }))
        .catch(() => ({
          cachedProduct: null,
          kind: 'lcp-hint' as const,
          primaryImage: null,
        })),
      merchantPromise.then(
        () => ({ kind: 'merchant-ready' as const }),
        () => ({ kind: 'merchant-ready' as const })
      ),
    ]);

    if (
      earlyPreloadResult.kind === 'lcp-hint' &&
      earlyPreloadResult.primaryImage &&
      earlyPreloadResult.cachedProduct
    ) {
      try {
        preloadOgabasseyPdpProductResources({
          src: earlyPreloadResult.primaryImage,
        });
        preloadedProductResourceKey = getDirectProductPreloadKey(
          earlyPreloadResult.primaryImage
        );
      } catch (error) {
        console.warn(
          'Unable to preload OgaBassey PDP resources early:',
          sanitizeLookupLogValue(productSlug),
          error
        );
      }
    }
  }

  const merchant = await merchantPromise;

  if (!merchant) {
    console.warn('Merchant not found for storefront product route:', storeSlug);
    return null;
  }

  let cachedProduct = await getCachedProductLcpHint(merchant.id, productSlug, {
    includeVariants: true,
  });
  let needsValuesRedirect = false;

  if (!cachedProduct && productSlug !== productSlug.toLowerCase()) {
    cachedProduct = await getCachedProductLcpHint(
      merchant.id,
      productSlug.toLowerCase(),
      { includeVariants: true }
    );
  }

  if (!cachedProduct) {
    const result = await getProductForMerchant(
      merchant,
      categorySlug,
      productSlug
    );
    return result
      ? {
          result,
          loadProductResult: () => Promise.resolve(result),
          preloadedProductResourceKey,
        }
      : null;
  }

  const product = mapCachedProductLcpHintToRouteProduct(cachedProduct);
  needsValuesRedirect = shouldRedirectResolvedProductSlugValue(
    productSlug,
    product.slug
  );
  const loadProductResult = () =>
    getProduct(storeSlug, categorySlug, productSlug);

  return {
    result: {
      product,
      merchant,
      categoryMismatch: hasCategoryMismatch(
        getMappedProductCategorySlug(product),
        categorySlug
      ),
      needsValuesRedirect,
    },
    loadProductResult,
    preloadedProductResourceKey,
  };
}

function buildCategoryProductMetadata({
  baseUrl,
  merchant,
  product,
}: {
  baseUrl: string;
  merchant: CachedMerchant;
  product: LcpRouteProduct;
}): Metadata {
  const canonicalUrl = getValidatedProductUrl(product, baseUrl, merchant.slug);
  const productCategoryName =
    product.categories?.name ||
    product.category ||
    DEFAULT_STOREFRONT_SEO_CATEGORY;
  const merchantDisplayName = merchant?.business_name || DEFAULT_STORE_NAME;
  const currency = merchant.payout_currency || 'NGN';
  const priceSeoCopy = buildProductPriceSeoCopy({
    product,
    merchantDisplayName,
    categoryName: productCategoryName,
    currency,
    country: merchant.country,
  });
  const productDescription = stripVolatileProductPriceSentences(
    product.description
  );
  const productMetaDescription = stripVolatileProductPriceSentences(
    product.meta_description
  );
  const productDescriptionFallback =
    productDescription || priceSeoCopy.description;
  const seoDescriptionSource =
    productMetaDescription ||
    (priceSeoCopy.priceText
      ? priceSeoCopy.description
      : productDescriptionFallback);
  const seoDescription = generateMetaDescription(seoDescriptionSource, 160, {
    minLength: 110,
    fallback: productDescriptionFallback,
  });
  const socialMetadata = getStorefrontProductSocialMetadata(
    baseUrl,
    product,
    currency
  );
  const metadataTitle = generateMetaTitle(
    product.meta_title || priceSeoCopy.title,
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
    keywords: product.keywords ?? undefined,
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

// Prerender OgaBassey's most recent active PDPs at build so the above-fold
// hero ships inside the static PPR shell (LCP). Without concrete params the
// product slug is request-time, which keeps the hero in the dynamic resume.
// Params not listed here keep rendering on demand (the default PPR behavior
// under cacheComponents — `dynamicParams` cannot be set with cacheComponents).
const OGABASSEY_PRERENDER_LIMIT = 50;
// Keep the actively monitored, revenue-critical PDP in the prerender set even
// when it is older than the newest-products window. This gives the route a
// static shell and earlier LCP image discovery without expanding build scope.
const OGABASSEY_PRIORITY_PRERENDER_PRODUCTS = [
  {
    category: 'gaming-laptops',
    productSlug: 'dell-alienware-m18-r3-rtx-5080',
  },
] as const;

export async function generateStaticParams(): Promise<
  Array<{ slug: string; category: string; productSlug: string }>
> {
  // cacheComponents requires generateStaticParams to return >= 1 param; this
  // placeholder keeps the build valid (and renders notFound) if the index is
  // empty/unavailable. Real, non-listed products still render on demand.
  const placeholder = [
    {
      slug: OGABASSEY_DOMAIN,
      category: 'smartphones',
      productSlug: '__prerender_placeholder__',
    },
  ];

  let products: Awaited<
    ReturnType<typeof getCachedStorefrontProductIndex>
  >['products'] = [];
  try {
    const result = await getCachedStorefrontProductIndex(
      OGABASSEY_MERCHANT_ID,
      {
        page: 1,
        limit: OGABASSEY_PRERENDER_LIMIT,
      }
    );
    if (result.hasError) {
      return placeholder;
    }
    products = result.products;
  } catch {
    // A rejected index lookup at build/prerender time must fall back to the
    // placeholder, not throw and fail the whole prerender step.
    return placeholder;
  }

  const seen = new Set<string>();
  const params: Array<{ slug: string; category: string; productSlug: string }> =
    [];

  for (const product of OGABASSEY_PRIORITY_PRERENDER_PRODUCTS) {
    const key = `${product.category}/${product.productSlug}`;
    seen.add(key);
    params.push({ slug: OGABASSEY_DOMAIN, ...product });
  }

  for (const product of products) {
    const category = product.category_slug?.trim();
    const productSlug = product.slug?.trim();
    if (!category || !productSlug) {
      continue;
    }
    const key = `${category}/${productSlug}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    params.push({ slug: OGABASSEY_DOMAIN, category, productSlug });
  }

  return params.length > 0 ? params : placeholder;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, category, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }
  const routeControl = await getProductRouteControl(
    slug,
    category,
    productSlug
  );

  if (!routeControl) {
    notFound();
  }

  // Don't redirect from generateMetadata — Next.js can't change HTTP status
  // from here and falls back to an HTML <meta refresh>, which Google indexes
  // as "Excluded by 'noindex' tag". The page component below runs the same
  // permanentRedirect() before any HTML streams, producing a real HTTP 308.
  // Return bare, noindex metadata here as a safety net for the race.
  const { result } = routeControl;

  if (!('product' in result)) {
    return CANONICAL_PRODUCT_REDIRECT_METADATA;
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } = result;

  if (categoryMismatch || needsValuesRedirect) {
    return CANONICAL_PRODUCT_REDIRECT_METADATA;
  }

  const baseUrl = buildStoreUrl(merchant);
  return buildCategoryProductMetadata({ baseUrl, merchant, product });
}

interface CategoryProductPageContentProps {
  renderMode?: 'full' | 'belowFold';
  slug: string;
  searchParams: PageProps['searchParams'];
  productResultPromise: Promise<CategoryProductResult>;
}

async function getRenderableCategoryProductResult({
  slug,
  searchParams,
  productResultPromise,
}: Omit<CategoryProductPageContentProps, 'renderMode'>) {
  const result = await productResultPromise;

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

  const resolvedSearchParams = await searchParams;
  redirectInvalidVariantSelectionParams(slug, product, resolvedSearchParams);

  return { merchant, product };
}

async function getRequestScopedCategoryProductBasePath(
  slug: string
): Promise<'' | `/${string}`> {
  const shellSnapshotBase = await getStorefrontShellSnapshotBase(slug);

  if (!shellSnapshotBase) {
    return getCategoryProductBasePath(slug);
  }

  const { basePath } = shellSnapshotBase;

  if (typeof basePath !== 'string') {
    return getCategoryProductBasePath(slug);
  }

  if (basePath === '') {
    return '';
  }

  return basePath.startsWith('/')
    ? (basePath as `/${string}`)
    : getCategoryProductBasePath(slug);
}

async function CategoryProductPageContent({
  renderMode = 'full',
  slug,
  searchParams,
  productResultPromise,
}: CategoryProductPageContentProps) {
  const { merchant, product } = await getRenderableCategoryProductResult({
    slug,
    searchParams,
    productResultPromise,
  });

  const baseUrl = buildStoreUrl(merchant);
  const renderableProduct: Product = {
    ...product,
    description: stripVolatileProductPriceSentences(product.description),
    ...(product.meta_description && {
      meta_description: stripVolatileProductPriceSentences(
        product.meta_description
      ),
    }),
  };
  const resolvedCategorySlug =
    renderableProduct.category_slug ||
    (renderableProduct.category
      ? generateSlug(renderableProduct.category)
      : 'products');
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const currency = merchant.payout_currency || 'NGN';
  const priceSeoCopy = buildProductPriceSeoCopy({
    product: renderableProduct,
    merchantDisplayName: merchant?.business_name || DEFAULT_STORE_NAME,
    categoryName: renderableProduct.category || 'All Products',
    currency,
    country: merchant.country,
  });
  const plainProductDescription = stripHtmlTags(renderableProduct.description)
    .replace(/\s+/g, ' ')
    .trim();
  const trustBullets = [
    priceSeoCopy.answer,
    ...buildTrustBulletsFromProfile(trustProfile),
  ];
  const semanticSections = (
    <Suspense fallback={null}>
      <OgabasseyPdpSemanticSections
        categoryName={renderableProduct.category || 'All Products'}
        categorySlug={resolvedCategorySlug}
        merchant={merchant}
        product={renderableProduct}
        storeSlug={slug}
        storeUrl={baseUrl}
        trustBullets={trustBullets}
      />
    </Suspense>
  );
  const derivedSpecData = buildOgabasseyProductSpecData(renderableProduct);
  const schemaProduct =
    derivedSpecData.detailedSpecs.length > 0
      ? {
          ...renderableProduct,
          specifications: derivedSpecData.detailedSpecs,
        }
      : renderableProduct;

  const productUrl = getValidatedProductUrl(
    renderableProduct,
    baseUrl,
    merchant.slug
  );

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    schemaProduct,
    merchant?.business_name || 'Baci Store',
    currency,
    merchant?.country || 'NG',
    merchant?.logo_url,
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
    { name: renderableProduct.category || 'All Products', url: categoryUrl },
    { name: renderableProduct.name, url: productUrl },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
  const productPage = await renderTemplateProductPage({
    product: renderableProduct,
    renderMode,
    semanticSections,
    templateId: merchant?.template_id,
  });

  return (
    <>
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script type="application/ld+json">
        {safeJsonLdStringify(productSchema)}
      </script>
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script type="application/ld+json">
        {safeJsonLdStringify(breadcrumbSchema)}
      </script>
      {/* Hidden crawlable summary without a second page-level heading */}
      <article
        className="sr-only"
        aria-label={`${renderableProduct.name} summary`}
      >
        <p>{priceSeoCopy.answer}</p>
        {plainProductDescription ? <p>{plainProductDescription}</p> : null}
        <dl>
          <dt>Brand</dt>
          <dd>{renderableProduct.brand || 'OgaBassey'}</dd>
          <dt>Category</dt>
          <dd>{renderableProduct.category || 'Electronics'}</dd>
          <dt>Condition</dt>
          <dd>{renderableProduct.condition || 'New'}</dd>
          <dt>Price</dt>
          <dd>{priceSeoCopy.priceText || 'Contact for price'}</dd>
        </dl>
      </article>
      {productPage}
    </>
  );
}

export default async function CategoryProductPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, category, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const routeControl = await getProductRouteControl(
    slug,
    category,
    productSlug
  );

  if (!routeControl) {
    notFound();
  }

  const {
    result: productResult,
    loadProductResult,
    preloadedProductResourceKey,
  } = routeControl;

  if (!('product' in productResult)) {
    permanentRedirect(
      getRedirectTargetPath(slug, productResult.legacyRedirectTarget)
    );
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } =
    productResult;

  if (categoryMismatch || needsValuesRedirect) {
    permanentRedirect(getRedirectTargetPath(slug, product));
  }

  const primaryProductImage = product.imageLarge || product.image || null;
  const criticalProduct =
    merchant.template_id === OGABASSEY_TEMPLATE_ID
      ? buildOgabasseyPdpCriticalProduct(product)
      : null;
  const pageOwnsProductPreload = merchant.template_id === OGABASSEY_TEMPLATE_ID;
  const pagePreloadProductImage = pageOwnsProductPreload
    ? primaryProductImage
    : null;
  const pagePreloadResourceKey =
    pagePreloadProductImage !== null
      ? getDirectProductPreloadKey(pagePreloadProductImage)
      : null;
  const shouldPreloadProductImage =
    pagePreloadResourceKey !== null &&
    pagePreloadResourceKey !== preloadedProductResourceKey;

  try {
    if (shouldPreloadProductImage && pagePreloadProductImage) {
      preloadOgabasseyPdpProductResources({ src: pagePreloadProductImage });
    }
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP resources early:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }

  const criticalBasePathPromise = criticalProduct
    ? getRequestScopedCategoryProductBasePath(slug)
    : Promise.resolve<'' | `/${string}`>('');
  const productResultPromise = loadProductResult();

  const resolvedSearchParams = await searchParams;
  const commerceProduct = buildCriticalCommerceRouteProduct(product);
  redirectInvalidVariantSelectionParams(
    slug,
    commerceProduct,
    resolvedSearchParams
  );
  const resolvedSearchParamsPromise = Promise.resolve(resolvedSearchParams);
  const criticalCommerceContext = criticalProduct
    ? (() => {
        const rawVariantAttributes = (
          commerceProduct as { variant_attributes?: unknown }
        ).variant_attributes as VariantAttributeSource;
        const variantCount = commerceProduct.variants?.length ?? 0;
        const variantAxisOptions = mergeVariantAxisOptions(
          commerceProduct.variants,
          rawVariantAttributes,
          commerceProduct.condition
        );

        return {
          cartProduct: createCriticalCartProduct(commerceProduct),
          initialVariantSelection: getInitialCriticalVariantSelection(
            commerceProduct,
            resolvedSearchParams
          ),
          product: {
            ...criticalProduct,
            variantCount,
          },
          variantAxes: getFirstViewportVariantAxes(
            commerceProduct.variants,
            rawVariantAttributes,
            commerceProduct.condition
          ),
          variantAxisOptions,
          variantCount,
        };
      })()
    : null;

  return (
    <>
      {criticalCommerceContext ? (
        <OgabasseyPdpCriticalCommerceProvider
          cartProduct={criticalCommerceContext.cartProduct}
          initialVariantSelection={
            criticalCommerceContext.initialVariantSelection
          }
          variantAxes={criticalCommerceContext.variantAxes}
          variantAxisOptions={criticalCommerceContext.variantAxisOptions}
          variantCount={criticalCommerceContext.variantCount}
        >
          <OgabasseyPdpCriticalShell
            basePath={getCategoryProductBasePath(slug)}
            basePathPromise={criticalBasePathPromise}
            product={criticalCommerceContext.product}
            summaryCommerce={<OgabasseyPdpCriticalCommerceSummary />}
          >
            <OgabasseyPdpCriticalCommerce
              cartBasePathPromise={criticalBasePathPromise}
              product={criticalCommerceContext.product}
            />
          </OgabasseyPdpCriticalShell>
          <Suspense fallback={null}>
            <CategoryProductPageContent
              renderMode="belowFold"
              slug={slug}
              searchParams={resolvedSearchParamsPromise}
              productResultPromise={productResultPromise}
            />
          </Suspense>
        </OgabasseyPdpCriticalCommerceProvider>
      ) : (
        <Suspense
          fallback={
            <OgabasseyPdpProductLcpSkeleton
              merchant={merchant}
              primaryProductImage={
                merchant.template_id === OGABASSEY_TEMPLATE_ID
                  ? primaryProductImage
                  : null
              }
              productName={product.name}
            />
          }
        >
          <CategoryProductPageContent
            renderMode="full"
            slug={slug}
            searchParams={resolvedSearchParamsPromise}
            productResultPromise={productResultPromise}
          />
        </Suspense>
      )}
    </>
  );
}
