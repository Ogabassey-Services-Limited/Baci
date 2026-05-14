import {
  getEffectiveProductStock,
  getProductStockBucket,
  toSchemaItemConditionUri,
} from '@baci/shared/lib';
import type { Metadata, Route } from 'next';
import type {
  Product,
  ProductSchemaMarkup,
  ProductVariant,
  Review,
} from './products';
// Import from sanitize-core to avoid loading jsdom on server components
import { escapeHtml, stripHtmlTags } from './sanitize-core';
import { sanitizeSchemaMarkup, sanitizeSchemaUrl } from './sanitize-json-ld';
import { normalizeSocialUrl } from './social';
import { normalizeStorefrontCanonicalUrl } from './storefront-canonical-url';
import type {
  MerchantTrustProfile,
  MerchantTrustProfileReturnFee,
  MerchantTrustProfileReturnMethod,
} from './storefront-trust/merchant-trust-profile-types';

// Re-export escapeHtml for use in other modules
export { escapeHtml, getEffectiveProductStock };

/**
 * Lightly normalizes a category slug for use in canonical product paths.
 *
 * Unlike the storefront `normalizeStorefrontCategorySlug` helper, this does
 * NOT remap legacy category aliases (e.g. `phones` -> `smartphones`).
 * Canonical product URLs must match the merchant's stored `category_slug`
 * exactly — otherwise the product route's `categoryMismatch` check (which
 * compares the raw DB slug to the URL segment) will trigger a permanent
 * redirect back to the normalized path, causing a self-redirect loop for
 * merchants whose products still use the legacy slug values.
 */
function normalizeCanonicalCategorySlug(
  slug: string | null | undefined
): string | null {
  const normalized = slug?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getSchemaItemCondition(condition?: string | null) {
  if (!condition || condition.trim() === '') {
    return 'https://schema.org/NewCondition';
  }

  return toSchemaItemConditionUri(condition);
}

function getSchemaAvailability(product: {
  manage_stock?: boolean | null;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  low_stock_threshold?: number | string | null;
}) {
  return getProductStockBucket(product) === 'out_of_stock'
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';
}

/**
 * Generates a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

/**
 * Generates a full product slug including condition
 * Examples:
 *   - "iPhone 12" (new) → "iphone-12-new"
 *   - "iPhone 12" (used) → "iphone-12-used"
 *   - "iPhone 12" (refurbished) → "iphone-12-refurbished"
 *   - "iPhone 12" (no condition) → "iphone-12"
 */
export function generateProductSlug(
  name: string,
  _condition?: 'new' | 'used' | string,
  _conditionDetail?: string
): string {
  // Phase 7: Condition Deduplication
  // We no longer inject condition into the slug. Slugs should be unique to the PRODUCT FAMILY (e.g. "iphone-12")
  // The condition is handled via query params or internal product logic.
  // We strip common condition suffixes from the name if they exist, to ensure clean slugs.
  let cleanName = name;
  const lowerName = name.toLowerCase();

  // Basic cleanup of condition terms if they are part of the name
  if (lowerName.endsWith(' (new)')) cleanName = name.slice(0, -6);
  else if (lowerName.endsWith(' (used)')) cleanName = name.slice(0, -7);
  else if (lowerName.endsWith(' new')) cleanName = name.slice(0, -4);
  else if (lowerName.endsWith(' used')) cleanName = name.slice(0, -5);

  return generateSlug(cleanName);
}

/**
 * Builds the product URL path based on available data
 * Priority:
 *   1. /{category}/{product-slug} (if category exists)
 *   2. /products/{product-slug} (fallback)
 *
 * Examples:
 *   - smartphones, "iphone-12-used" → "/smartphones/iphone-12-used"
 *   - null, "generic-item" → "/products/generic-item"
 *
 * @param productSlug The product slug
 * @param category Category object with name/slug, or legacy TEXT category string
 * @param categorySlug Category slug (for backward compatibility)
 */
export function buildProductUrl(
  productSlug: string,
  category?: string | null | { name?: string; slug?: string },
  categorySlug?: string | null
): Route {
  // IMPORTANT: Canonical product paths must match the merchant's stored
  // `category_slug` exactly (after lowercase/trim). The storefront product
  // route compares the raw DB slug against the URL segment to detect
  // category mismatches and issues a permanent redirect when they differ.
  // Applying alias normalization here (e.g. `phones` -> `smartphones`) would
  // produce URLs that trigger a mismatch every request, creating a
  // self-redirect loop for legacy-slug products.
  if (typeof category === 'object' && category?.slug) {
    const normalizedCategorySlug = normalizeCanonicalCategorySlug(
      category.slug
    );
    if (normalizedCategorySlug) {
      return `/${normalizedCategorySlug}/${productSlug}` as Route;
    }
  }
  const normalizedCategorySlug = normalizeCanonicalCategorySlug(categorySlug);
  if (normalizedCategorySlug) {
    return `/${normalizedCategorySlug}/${productSlug}` as Route;
  }
  if (typeof category === 'string') {
    const slug = normalizeCanonicalCategorySlug(generateSlug(category));
    if (slug) {
      return `/${slug}/${productSlug}` as Route;
    }
  }
  return `/products/${productSlug}` as Route;
}

/**
 * Generates the full product URL path from product data
 * Convenience function combining slug generation and URL building
 */
export function getProductUrl(product: {
  slug?: string;
  name: string;
  category?: string | null;
  categories?: { name?: string; slug?: string } | null;
  category_slug?: string | null;
  categorySlug?: string;
  canonical_url?: string | null;
  condition?: 'new' | 'used' | string;
  condition_detail?: string;
  id: string;
}): Route {
  const canonicalPath = extractCanonicalProductPath(product.canonical_url);
  if (canonicalPath) {
    return canonicalPath;
  }

  // Use existing slug or generate one
  const productSlug =
    product.slug ||
    generateProductSlug(
      product.name,
      product.condition,
      product.condition_detail
    ) ||
    product.id;

  // Extract category slug from categories object if available
  const categorySlug =
    product.categories?.slug || product.category_slug || product.categorySlug;

  return buildProductUrl(
    productSlug,
    product.categories?.name || product.category,
    categorySlug
  );
}

export function getValidatedProductUrl(
  product: Parameters<typeof getProductUrl>[0],
  baseUrl: string,
  merchantSlug?: string | null
): string {
  let storeOrigin = '';
  try {
    storeOrigin = new URL(baseUrl).origin;
  } catch {
    storeOrigin = '';
  }

  const finalProductPath = getProductUrl({
    ...product,
    canonical_url: null,
  });
  let canonicalUrl = normalizeStorefrontCanonicalUrl(
    product.canonical_url,
    storeOrigin,
    merchantSlug
  );

  if (canonicalUrl) {
    try {
      const parsedCanonicalUrl = new URL(canonicalUrl, baseUrl);
      const canonicalPath =
        parsedCanonicalUrl.pathname.replace(/\/+$/, '') || '/';
      const normalizedFinalPath = finalProductPath.replace(/\/+$/, '') || '/';
      if (
        parsedCanonicalUrl.search ||
        parsedCanonicalUrl.hash ||
        canonicalPath !== normalizedFinalPath
      ) {
        canonicalUrl = undefined;
      }
    } catch {
      canonicalUrl = undefined;
    }
  }

  return canonicalUrl || `${storeOrigin}${finalProductPath}`;
}

const STOREFRONT_ROOT_SEGMENTS = new Set([
  'products',
  'blog',
  'smartphones',
  'laptops',
  'macbooks',
  'gaming',
  'accessories',
  'audio',
  'tablets',
  'desktops',
  'monitors',
  'smartwatches',
  'gaming-laptops',
  'gift-cards',
  'gaming-accessories',
  'earbuds',
  'headphones',
  'wearables',
  'printers',
  'repair',
  'repairs',
  'swap',
  'wallet',
  'account',
  'wishlist',
  'faq',
  'about',
  'terms',
  'privacy',
]);

const NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS = new Set([
  'about',
  'account',
  'api',
  'blog',
  'faq',
  'favicon',
  'icon',
  'manifest',
  'opengraph-image',
  'privacy',
  'repair',
  'repairs',
  'robots',
  'rss',
  'sitemap',
  'sitemaps',
  'swap',
  'terms',
  'twitter-image',
  'wallet',
  'wishlist',
]);

function extractCanonicalProductPath(
  canonicalUrl: string | null | undefined
): Route | null {
  const normalizedCanonical = canonicalUrl?.trim();
  if (!normalizedCanonical) {
    return null;
  }

  try {
    const parsed = new URL(normalizedCanonical, 'https://storefront.invalid');
    const canonicalSegments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (canonicalSegments.length === 0) {
      return null;
    }

    // For canonicals shaped like `/{merchantSlug}/{category}/{product}` we want
    // to drop the merchant-slug prefix so the returned Route matches the app
    // router's expected `/{category}/{product}` shape. Detect this by
    // requiring the SECOND segment to be a known storefront root segment —
    // i.e. only strip when we have positive evidence the leading segment is a
    // merchant prefix. Previously we stripped for *any* first segment that
    // wasn't in STOREFRONT_ROOT_SEGMENTS, which incorrectly rewrote legitimate
    // 3-segment canonicals like `/phones/iphone-15/black` into bogus
    // 2-segment paths.
    if (
      canonicalSegments.length >= 3 &&
      !STOREFRONT_ROOT_SEGMENTS.has(canonicalSegments[0].toLowerCase()) &&
      STOREFRONT_ROOT_SEGMENTS.has(canonicalSegments[1].toLowerCase())
    ) {
      canonicalSegments.shift();
    }

    if (canonicalSegments.length !== 2) {
      return null;
    }

    // Do NOT apply alias normalization here. Merchant-authored canonical
    // URLs must be returned as-is (after lowercasing) so the canonical
    // matches the merchant's stored `category_slug`. Alias remapping would
    // recreate the same self-redirect loop fixed in `buildProductUrl`.
    const normalizedCategorySlug = normalizeCanonicalCategorySlug(
      canonicalSegments[0]
    );
    if (normalizedCategorySlug) {
      canonicalSegments[0] = normalizedCategorySlug;
    }

    const [rootSegment, productSlug] = canonicalSegments;
    if (!productSlug) {
      return null;
    }

    // Reject any segment with a file extension (e.g. sitemap.xml, robots.txt,
    // opengraph-image.png) so metadata endpoints never masquerade as product
    // routes.
    if (rootSegment.includes('.') || productSlug.includes('.')) {
      return null;
    }

    const rootSegmentLower = rootSegment.toLowerCase();
    if (NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS.has(rootSegmentLower)) {
      return null;
    }

    if (rootSegmentLower === 'products') {
      return `/products/${productSlug}` as Route;
    }

    if (
      !normalizedCategorySlug ||
      NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS.has(normalizedCategorySlug)
    ) {
      return null;
    }

    return `/${normalizedCategorySlug}/${productSlug}` as Route;
  } catch {
    return null;
  }
}

/**
 * Weight unit mapping to schema.org unit codes
 */
const WEIGHT_UNIT_CODES: Record<string, string> = {
  kg: 'KGM',
  lb: 'LBR',
  g: 'GRM',
  oz: 'ONZ',
};

/**
 * Dimension unit mapping to schema.org unit codes
 */
const DIMENSION_UNIT_CODES: Record<string, string> = {
  in: 'INH',
  m: 'MTR',
  cm: 'CMT',
};

/**
 * Number of milliseconds in a day
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of milliseconds in 30 days
 */
const THIRTY_DAYS_MS = 30 * MILLISECONDS_PER_DAY;

/**
 * Maps common variant attribute keys to Google-supported variesBy property URLs.
 * Google only recognizes 6 specific values for variesBy:
 * color, size, suggestedAge, suggestedGender, material, pattern
 * Unsupported attributes return undefined and are excluded from variesBy.
 * @see https://developers.google.com/search/docs/appearance/structured-data/product#product-variants
 */
function schemaPropertyForAttribute(key: string): string | undefined {
  const map: Record<string, string> = {
    color: 'https://schema.org/color',
    colour: 'https://schema.org/color',
    size: 'https://schema.org/size',
    storage: 'https://schema.org/size',
    ram: 'https://schema.org/size',
    material: 'https://schema.org/material',
    pattern: 'https://schema.org/pattern',
    age: 'https://schema.org/suggestedAge',
    gender: 'https://schema.org/suggestedGender',
  };
  return map[key.toLowerCase()];
}

function getNormalizedVariantAttribute(
  attributes: Record<string, string> | null | undefined,
  keys: string[]
): string | undefined {
  if (!attributes) {
    return undefined;
  }

  for (const key of keys) {
    const matchedKey =
      key in attributes
        ? key
        : Object.keys(attributes).find(
            (attributeKey) => attributeKey.toLowerCase() === key.toLowerCase()
          );
    const value = matchedKey ? attributes[matchedKey] : undefined;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getVariantSchemaColor(
  attributes: Record<string, string> | null | undefined
): string | undefined {
  return getNormalizedVariantAttribute(attributes, ['color', 'colour']);
}

function getVariantSchemaSize(
  attributes: Record<string, string> | null | undefined
): string | undefined {
  const explicitSize = getNormalizedVariantAttribute(attributes, ['size']);
  if (explicitSize) {
    return explicitSize;
  }

  const inferredParts = [
    getNormalizedVariantAttribute(attributes, ['storage']),
    getNormalizedVariantAttribute(attributes, ['ram']),
  ].filter((value): value is string => Boolean(value));

  if (inferredParts.length === 0) {
    return undefined;
  }

  return Array.from(new Set(inferredParts)).join(' / ');
}

function mapReturnMethodToSchemaUrl(
  returnMethod: MerchantTrustProfileReturnMethod | undefined
): string | undefined {
  switch (returnMethod) {
    case 'mail':
    case 'carrier_dropoff':
      return 'https://schema.org/ReturnByMail';
    case 'in_store':
      return 'https://schema.org/ReturnInStore';
    default:
      return undefined;
  }
}

function mapReturnFeeToSchemaUrl(
  returnFees: MerchantTrustProfileReturnFee | undefined
): string | undefined {
  switch (returnFees) {
    case 'free':
      return 'https://schema.org/FreeReturn';
    case 'customer_pays':
      return 'https://schema.org/ReturnShippingFees';
    case 'original_shipping_deducted':
      return 'https://schema.org/OriginalShippingFees';
    default:
      return undefined;
  }
}

function buildSameAsUrls(
  data: OrganizationData,
  trustProfile?: MerchantTrustProfile
): string[] {
  const sameAs = new Set<string>();

  for (const url of Object.values(trustProfile?.socialLinks ?? {})) {
    const normalized = url.trim();
    if (normalized) {
      sameAs.add(escapeHtml(normalized));
    }
  }

  if (data.socialMedia) {
    const socialMediaEntries = [
      ['facebook', data.socialMedia.facebook],
      ['instagram', data.socialMedia.instagram],
      ['twitter', data.socialMedia.twitter],
      ['linkedin', data.socialMedia.linkedin],
      ['youtube', data.socialMedia.youtube],
    ] as const;

    for (const [platform, handle] of socialMediaEntries) {
      const normalized = normalizeSocialUrl(handle, platform);
      if (normalized) {
        sameAs.add(escapeHtml(normalized));
      }
    }
  }

  return [...sameAs];
}

function buildContactPoint(
  data: OrganizationData,
  trustProfile?: MerchantTrustProfile
): Record<string, unknown> | undefined {
  const email = trustProfile?.supportEmail ?? data.email;
  const telephone = trustProfile?.supportPhone ?? data.telephone;

  if (!email && !telephone) {
    return undefined;
  }

  return {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    ...(email && { email: escapeHtml(email) }),
    ...(telephone && { telephone: escapeHtml(telephone) }),
    availableLanguage: 'English',
  };
}

function buildMerchantReturnPolicy(
  country: string,
  trustProfile?: MerchantTrustProfile,
  fallbackDays = 7
): Record<string, unknown> | undefined {
  const returnPolicy = trustProfile?.returnPolicy;

  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: country,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: returnPolicy?.windowDays ?? fallbackDays,
    returnMethod:
      mapReturnMethodToSchemaUrl(returnPolicy?.returnMethod) ??
      'https://schema.org/ReturnInStore',
    returnFees:
      mapReturnFeeToSchemaUrl(returnPolicy?.returnFees) ??
      'https://schema.org/FreeReturn',
  };
}

function buildOfferShippingDetails(
  country: string,
  currency: string,
  trustProfile?: MerchantTrustProfile
): Record<string, unknown> {
  const shippingPolicy = trustProfile?.shippingPolicy;
  const handlingMin = shippingPolicy?.handlingDaysMin ?? 0;
  const handlingMax = shippingPolicy?.handlingDaysMax ?? 1;
  const transitMin = shippingPolicy?.transitDaysMin ?? 1;
  const transitMax = shippingPolicy?.transitDaysMax ?? 5;

  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 0,
      currency,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: country,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: handlingMin,
        maxValue: handlingMax,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: transitMin,
        maxValue: transitMax,
        unitCode: 'DAY',
      },
    },
  };
}

function buildMerchantReturnPolicyFromTrustProfile(
  country: string,
  trustProfile?: MerchantTrustProfile
): Record<string, unknown> {
  const returnPolicy = trustProfile?.returnPolicy;
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: country,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: returnPolicy?.windowDays ?? 7,
    returnMethod:
      mapReturnMethodToSchemaUrl(returnPolicy?.returnMethod) ??
      'https://schema.org/ReturnInStore',
    returnFees:
      mapReturnFeeToSchemaUrl(returnPolicy?.returnFees) ??
      'https://schema.org/FreeReturn',
  };
}

interface ProductSchemaOptions {
  productUrl?: string;
}

function parseStructuredDataUrl(url: string | undefined): URL | undefined {
  if (!url) {
    return undefined;
  }

  const sanitizedUrl = sanitizeSchemaUrl(url);
  if (!sanitizedUrl) {
    return undefined;
  }

  try {
    return new URL(sanitizedUrl);
  } catch {
    return undefined;
  }
}

function buildStructuredDataVariantUrl(
  productUrl: URL | undefined,
  variant: ProductVariant
): string | undefined {
  if (!productUrl) {
    return undefined;
  }

  const url = new URL(productUrl);
  url.searchParams.set('variantId', variant.id);

  return url.toString();
}

/**
 * Generates JSON-LD structured data for a product (2025 Google best practices)
 * For products with variants, outputs @type ProductGroup with hasVariant (each variant has its own Offer).
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */
export function generateProductSchema(
  product: Product,
  merchantName: string = 'Baci Store',
  currency: string = 'USD',
  country: string = 'NG', // Default to Nigeria
  merchantLogo?: string,
  trustProfile?: MerchantTrustProfile,
  options: ProductSchemaOptions = {}
): ProductSchemaMarkup & Record<string, unknown> {
  // Keep schema values as data. safeJsonLdStringify handles script-context escaping
  // at serialization time so structured-data parsers receive unmodified values.
  const safeName = product.name;

  // Provide a smart fallback for description to prevent "Missing field description" errors
  const rawDescription = product.meta_description || product.description;
  const metaDescription = rawDescription
    ? generateMetaDescription(rawDescription)
    : '';
  const safeDescription = metaDescription
    ? metaDescription
    : `Buy ${safeName} from ${merchantName}. Best prices, fast delivery, and secure payments.`;

  const safeBrand = product.brand || merchantName;
  const safeMerchantName = merchantName;
  const structuredDataProductUrl = parseStructuredDataUrl(options.productUrl);
  const shippingDetails = buildOfferShippingDetails(
    country,
    currency,
    trustProfile
  );
  const hasMerchantReturnPolicy = buildMerchantReturnPolicyFromTrustProfile(
    country,
    trustProfile
  );

  // Extract images — handle both {url: string} objects and plain string entries defensively
  let safeImages: string[] = [];
  if (product.images && product.images.length > 0) {
    safeImages = product.images
      .map((img) => {
        const raw = typeof img === 'string' ? img : img?.url;
        return raw || '';
      })
      .filter(Boolean);
  } else if (product.imageLarge) {
    safeImages = [product.imageLarge];
  } else if (product.image) {
    safeImages = [product.image];
  }

  // Filter out any empty strings
  safeImages = safeImages.filter((img) => img.trim() !== '');

  // If no product images exist, use merchant logo as absolute fallback to satisfy Google Merchant requirements
  const finalImages =
    safeImages.length > 0
      ? safeImages
      : merchantLogo
        ? [merchantLogo]
        : undefined;

  const schema: ProductSchemaMarkup & Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: safeName,
    description: safeDescription,
    ...(structuredDataProductUrl && {
      url: structuredDataProductUrl.toString(),
    }),
    ...(finalImages && { image: finalImages }),
    brand: {
      '@type': 'Brand',
      name: safeBrand,
    },
    offers:
      product.offers && product.offers.length > 0
        ? product.offers.map((offer) => ({
            '@type': 'Offer',
            price: offer.price,
            priceCurrency: currency,
            ...(structuredDataProductUrl && {
              url: structuredDataProductUrl.toString(),
            }),
            availability: getSchemaAvailability({
              manage_stock: product.manage_stock,
              stock_quantity: offer.stock_quantity,
            }),
            itemCondition: getSchemaItemCondition(offer.condition),
            seller: {
              '@type': 'Organization',
              name: safeMerchantName,
            },
            priceValidUntil: new Date(Date.now() + THIRTY_DAYS_MS)
              .toISOString()
              .substring(0, 10),
            shippingDetails,
            hasMerchantReturnPolicy,
          }))
        : {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: currency,
            ...(structuredDataProductUrl && {
              url: structuredDataProductUrl.toString(),
            }),
            availability: getSchemaAvailability(product),
            itemCondition: getSchemaItemCondition(product.condition),
            seller: {
              '@type': 'Organization',
              name: safeMerchantName,
            },
            priceValidUntil: new Date(Date.now() + THIRTY_DAYS_MS)
              .toISOString()
              .substring(0, 10),
            shippingDetails,
            hasMerchantReturnPolicy,
          },
  };

  // Product identifiers are important for Google Merchant Center.
  if (product.sku) {
    schema.sku = product.sku;
  }

  if (product.gtin) {
    schema.gtin = product.gtin;
    if (product.gtin.length === 13) {
      schema.gtin13 = product.gtin;
    }
    if (product.gtin.length === 14) {
      schema.gtin14 = product.gtin;
    }
  }

  if (product.mpn) {
    schema.mpn = product.mpn;
  }

  // Category for Google Product Category.
  // Use joined categories.name from category_id, fallback to legacy TEXT field
  const categoryName = product.categories?.name || product.category;
  if (categoryName) {
    schema.category = categoryName;
  }

  // Physical attributes
  if (product.weight_value && product.weight_unit) {
    schema.weight = {
      '@type': 'QuantitativeValue',
      value: product.weight_value,
      unitCode: WEIGHT_UNIT_CODES[product.weight_unit] || 'KGM',
    };
  }

  // Detailed specifications for AI/Crawlers (additionalProperty)
  // This enables rich snippets and voice assistants to answer spec queries
  const additionalProperties = [];

  // Extract from product_key_specs (GSM Arena-level specs)
  const keySpecs = product.product_key_specs;

  if (keySpecs && !Array.isArray(keySpecs)) {
    interface SpecMapping {
      key: string;
      name: string;
      format?: (v: string | number | boolean | undefined) => string;
      check?: (v: string | number | boolean | undefined) => boolean;
    }

    const SPEC_MAPPINGS: SpecMapping[] = [
      // Network
      { key: 'network_technology', name: 'Network Technology' },
      { key: 'has_5g', name: '5G Support', format: (v) => (v ? 'Yes' : 'No') },
      { key: 'has_nfc', name: 'NFC', format: (v) => (v ? 'Yes' : 'No') },

      // Body
      { key: 'dimensions_mm', name: 'Dimensions' },
      { key: 'weight_g', name: 'Weight', format: (v) => `${v}g` },
      { key: 'build_materials', name: 'Build' },
      { key: 'ip_rating', name: 'IP Rating' },
      { key: 'sim_type', name: 'SIM Type' },

      // Display
      { key: 'display_type', name: 'Display Type' },
      {
        key: 'screen_size_inches',
        name: 'Screen Size',
        format: (v) => `${v} inches`,
      },
      { key: 'display_resolution', name: 'Display Resolution' },
      { key: 'refresh_rate_hz', name: 'Refresh Rate', format: (v) => `${v}Hz` },
      { key: 'display_ppi', name: 'Pixel Density', format: (v) => `${v} ppi` },
      {
        key: 'display_peak_brightness',
        name: 'Peak Brightness',
        format: (v) => `${v} nits`,
      },

      // Platform
      {
        key: 'android_version',
        name: 'Operating System',
        format: (v) => `Android ${v}`,
      },
      { key: 'chipset', name: 'Chipset' },
      { key: 'cpu_cores', name: 'CPU' },
      { key: 'gpu', name: 'GPU' },

      // Memory
      { key: 'ram_gb', name: 'RAM', format: (v) => `${v}GB` },
      { key: 'storage_gb', name: 'Internal Storage', format: (v) => `${v}GB` },
      {
        key: 'card_slot_type',
        name: 'Card Slot',
        check: () => Boolean(keySpecs.has_card_slot),
      },

      // Camera
      {
        key: 'front_camera_mp',
        name: 'Selfie Camera',
        format: (v) => `${v}MP`,
      },
      { key: 'rear_camera_video', name: 'Video Recording' },

      // Sound
      {
        key: 'has_stereo_speakers',
        name: 'Speakers',
        format: (v) => (v ? 'Stereo' : 'Mono'),
      },
      {
        key: 'has_headphone_jack',
        name: '3.5mm Headphone Jack',
        format: (v) => (v ? 'Yes' : 'No'),
      },

      // Connectivity
      { key: 'wifi_bands', name: 'WiFi' },
      { key: 'bluetooth_version', name: 'Bluetooth' },
      {
        key: 'usb_type',
        name: 'USB',
        format: (v) => String(v) + (keySpecs.has_usb_otg ? ' (OTG)' : ''),
      },
      {
        key: 'has_fm_radio',
        name: 'FM Radio',
        format: () => 'Yes',
        check: (v) => !!v,
      },

      // Features
      { key: 'fingerprint_type', name: 'Fingerprint Sensor' },

      // Battery
      {
        key: 'battery_mah',
        name: 'Battery Capacity',
        format: (v) => `${v}mAh`,
      },
      { key: 'charging_watt', name: 'Fast Charging', format: (v) => `${v}W` },
      {
        key: 'wireless_charging_watt',
        name: 'Wireless Charging',
        format: (v) => `${v}W`,
        check: () => Boolean(keySpecs.has_wireless_charging),
      },
    ];

    // Handle Main Camera logic separately (too complex for generic map)
    if (keySpecs.main_camera_mp) {
      const cameraType = keySpecs.has_quad_camera
        ? 'Quad'
        : keySpecs.has_triple_camera
          ? 'Triple'
          : keySpecs.has_dual_camera
            ? 'Dual'
            : 'Single';
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: 'Main Camera',
        value: `${cameraType} ${keySpecs.main_camera_mp}MP`,
      });
    }

    // Process configuration-driven specs
    for (const mapping of SPEC_MAPPINGS) {
      const value = keySpecs[mapping.key] as
        | string
        | number
        | boolean
        | undefined;
      const shouldInclude = mapping.check
        ? mapping.check(value)
        : value !== null && value !== undefined;

      if (shouldInclude) {
        additionalProperties.push({
          '@type': 'PropertyValue',
          name: mapping.name,
          value: mapping.format ? mapping.format(value) : String(value),
        });
      }
    }
  }

  // Also include legacy specifications format if present
  if (product.specifications && Array.isArray(product.specifications)) {
    for (const category of product.specifications) {
      if (category.items && Array.isArray(category.items)) {
        for (const item of category.items) {
          additionalProperties.push({
            '@type': 'PropertyValue',
            name: item.label,
            value: item.value,
          });
        }
      }
    }
  }

  if (additionalProperties.length > 0) {
    schema.additionalProperty = additionalProperties;
  }

  // Dimensions
  if (product.dimensions) {
    const dimUnit = DIMENSION_UNIT_CODES[product.dimensions.unit] || 'CMT';
    // Use product.dimensions.depth if available; fallback to length for backwards compatibility.
    // NOTE: Depth and length may represent the same physical dimension depending on historical data models.
    // This fallback ensures older product definitions using 'length' for depth still populate the schema.
    // Consider standardizing on 'depth' in future and updating legacy data accordingly.
    if (product.dimensions.depth) {
      schema.depth = {
        '@type': 'QuantitativeValue',
        value: product.dimensions.depth,
        unitCode: dimUnit,
      };
    } else if (product.dimensions.length) {
      schema.depth = {
        '@type': 'QuantitativeValue',
        value: product.dimensions.length,
        unitCode: dimUnit,
      };
    }
    if (product.dimensions.width) {
      schema.width = {
        '@type': 'QuantitativeValue',
        value: product.dimensions.width,
        unitCode: dimUnit,
      };
    }
    if (product.dimensions.height) {
      schema.height = {
        '@type': 'QuantitativeValue',
        value: product.dimensions.height,
        unitCode: dimUnit,
      };
    }
  }

  // Color (useful for apparel).
  if (product.color) {
    schema.color = product.color;
  }

  // Compare at price (for sales)
  if (
    product.compare_at_price &&
    product.compare_at_price > product.price &&
    schema.offers &&
    !Array.isArray(schema.offers)
  ) {
    schema.offers.priceSpecification = {
      '@type': 'PriceSpecification',
      price: product.price,
      priceCurrency: currency,
      valueAddedTaxIncluded: product.taxable !== false,
    };
  }

  // Add aggregateRating if product has reviews (improves Google rich results)
  // Only add if we have valid rating data to avoid empty/invalid schema
  if (
    product.rating !== undefined &&
    product.rating > 0 &&
    product.review_count !== undefined &&
    product.review_count > 0
  ) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.review_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Add individual reviews if available - [NEW 2025]
  if (product.reviews && product.reviews.length > 0) {
    // Sort reviews: 5 stars, then 4 stars, etc. (Descending order)
    const sortedReviews = [...product.reviews].sort(
      (a, b) => b.reviewRating - a.reviewRating
    );

    schema.review = sortedReviews.map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.author,
      },
      datePublished: review.datePublished,
      reviewBody: review.reviewBody,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.reviewRating,
        bestRating: '5',
        worstRating: '1',
      },
    }));
  }

  // Merge custom schema markup if provided (e.g. aggregateRating)
  // This allows merchants to extend the auto-generated schema with their own data
  if (product.schema_markup) {
    const sanitizedCustomSchema = sanitizeSchemaMarkup(product.schema_markup);
    // We merge sanitizedCustomSchema into schema
    // Using Object.assign to override/extend existing fields
    Object.assign(schema, sanitizedCustomSchema);
  }

  // ProductGroup transformation for products with variants
  // @see https://schema.org/ProductGroup
  if (product.variants && product.variants.length > 0) {
    schema['@type'] = 'ProductGroup';
    schema.productGroupID = product.slug || product.id;

    // Compute variesBy from unique attribute keys across all variants
    const allAttributeKeys = new Set<string>();
    for (const variant of product.variants) {
      if (variant.attributes) {
        for (const key of Object.keys(variant.attributes)) {
          allAttributeKeys.add(key);
        }
      }
    }

    if (allAttributeKeys.size > 0) {
      // Only include Google-supported variesBy values, deduplicated
      const variesBySet = new Set<string>();
      for (const key of allAttributeKeys) {
        const url = schemaPropertyForAttribute(key);
        if (url) variesBySet.add(url);
      }
      if (variesBySet.size > 0) {
        schema.variesBy = Array.from(variesBySet);
      }
    }

    // Shared shipping + return policy for all variant Offers (2026 best practice)
    const variantShippingDetails = buildOfferShippingDetails(
      country,
      currency,
      trustProfile
    );

    const variantReturnPolicy = buildMerchantReturnPolicyFromTrustProfile(
      country,
      trustProfile
    );

    const variantPriceValidUntil = new Date(Date.now() + THIRTY_DAYS_MS)
      .toISOString()
      .substring(0, 10);

    // Build hasVariant array — each variant becomes a @type Product
    schema.hasVariant = product.variants.map((variant) => {
      const variantPrice = variant.price_override ?? product.price;
      const variantUrl = buildStructuredDataVariantUrl(
        structuredDataProductUrl,
        variant
      );
      const variantCondition = getSchemaItemCondition(
        variant.condition ?? product.condition
      );
      const variantColor = getVariantSchemaColor(variant.attributes);
      const variantSize = getVariantSchemaSize(variant.attributes);
      const attrValues = variant.attributes
        ? Object.values(variant.attributes).join(' / ')
        : '';
      const variantName = attrValues ? `${safeName} - ${attrValues}` : safeName;

      // Variant images: use variant-specific images if available, fall back to parent images
      let variantImages: string[] | undefined;
      if (variant.images && variant.images.length > 0) {
        const filtered = variant.images.filter((img) => img.trim() !== '');
        if (filtered.length > 0) variantImages = filtered;
      }

      if (!variantImages) {
        variantImages = finalImages;
      }

      return {
        '@type': 'Product',
        name: variantName,
        description: safeDescription,
        ...(variantUrl && { url: variantUrl }),
        ...(variantImages && { image: variantImages }),
        brand: {
          '@type': 'Brand',
          name: safeBrand,
        },
        inProductGroupWithID: schema.productGroupID,
        ...(variantColor && { color: variantColor }),
        ...(variantSize && { size: variantSize }),
        sku: variant.sku || variant.id,
        ...(product.gtin && { gtin: product.gtin }),
        ...(product.mpn && { mpn: product.mpn }),
        offers: {
          '@type': 'Offer',
          price: variantPrice,
          priceCurrency: currency,
          ...(variantUrl && { url: variantUrl }),
          availability: getSchemaAvailability({
            manage_stock: product.manage_stock,
            stock_quantity: variant.stock_quantity,
          }),
          itemCondition: variantCondition,
          priceValidUntil: variantPriceValidUntil,
          seller: {
            '@type': 'Organization',
            name: safeMerchantName,
          },
          shippingDetails: variantShippingDetails,
          hasMerchantReturnPolicy: variantReturnPolicy,
        },
      };
    });

    // Per Google guidelines (2026): Do NOT use AggregateOffer for product variants.
    // Offers belong on each individual variant Product in hasVariant, not on ProductGroup.
    // Remove the parent-level Offer since variants carry their own.
    delete schema.offers;
  }

  return schema;
}

/**
 * Generates breadcrumb JSON-LD schema (2025 best practices)
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbSchema(
  items: BreadcrumbItem[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const normalizedUrl =
        toAbsoluteSchemaUrl(item.url, item.url) || item.url.trim() || '/';

      return {
        '@type': 'ListItem',
        position: index + 1,
        name: escapeHtml(item.name),
        item: escapeHtml(normalizedUrl),
      };
    }),
  };
}

/**
 * Generates FAQ schema for product pages with Q&A
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Generates FAQ schema for products or pages.
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: escapeHtml(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: escapeHtml(faq.answer),
      },
    })),
  };
}

/**
 * Generates LocalBusiness schema for merchant storefronts
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
export interface LocalBusinessData {
  name: string;
  description?: string;
  url: string;
  logo?: string;
  telephone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
    // ...
  };
  openingHours?: string[]; // e.g., ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]
  priceRange?: string; // e.g., "$$" or "₦₦"
  socialMedia?: Record<string, string>;
  rating?: {
    ratingValue: number;
    reviewCount: number;
  };
  reviews?: Review[];
}

/**
 * Generates LocalBusiness schema for merchant storefronts.
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
export function generateLocalBusinessSchema(
  business: LocalBusinessData
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: escapeHtml(business.name),
    url: escapeHtml(business.url),
  };

  if (business.description) {
    schema.description = escapeHtml(business.description);
  }

  if (business.logo) {
    const safeLogo = escapeHtml(business.logo);
    schema.logo = safeLogo;
    schema.image = safeLogo;
  }

  if (business.telephone) {
    schema.telephone = escapeHtml(business.telephone);
  }

  if (business.email) {
    schema.email = escapeHtml(business.email);
  }

  if (business.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: business.address.street
        ? escapeHtml(business.address.street)
        : undefined,
      addressLocality: business.address.city
        ? escapeHtml(business.address.city)
        : undefined,
      addressRegion: business.address.state
        ? escapeHtml(business.address.state)
        : undefined,
      postalCode: business.address.postalCode
        ? escapeHtml(business.address.postalCode)
        : undefined,
      addressCountry: escapeHtml(business.address.country || 'NG'),
    };
  }

  if (business.geo) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: business.geo.latitude,
      longitude: business.geo.longitude,
    };
  }

  if (business.openingHours) {
    schema.openingHours = business.openingHours.map((h) => escapeHtml(h));
  }

  if (business.priceRange) {
    schema.priceRange = escapeHtml(business.priceRange);
  }

  if (business.socialMedia) {
    schema.sameAs = Object.values(business.socialMedia)
      .filter(Boolean)
      .map((url) => escapeHtml(url));
  }

  // Add AggregateRating if provided
  if (business.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: business.rating.ratingValue,
      reviewCount: business.rating.reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // Add Reviews if provided
  if (business.reviews && business.reviews.length > 0) {
    // Sort reviews: 5 stars, then 4 stars, etc. (Descending order)
    const sortedReviews = [...business.reviews].sort(
      (a, b) => b.reviewRating - a.reviewRating
    );

    schema.review = sortedReviews.map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: escapeHtml(review.author),
      },
      datePublished: escapeHtml(review.datePublished),
      reviewBody: escapeHtml(review.reviewBody),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.reviewRating,
        bestRating: '5',
        worstRating: '1',
      },
    }));
  }

  return schema;
}

/**
 * Ellipsis string and length for meta description truncation
 */
const ELLIPSIS = '...';
const ELLIPSIS_LENGTH = ELLIPSIS.length;
const DEFAULT_MAX_LENGTH = 160;
const DEFAULT_MIN_LENGTH = 0;
const DEFAULT_TITLE_MAX_LENGTH = 70;

/**
 * Standard robots policy for indexable public storefront pages.
 */
export function getIndexableRobotsMetadata(): Metadata['robots'] {
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  };
}

/**
 * Validates and returns a proper maxLength value for meta description truncation.
 */
function validateMaxLength(value: number): number {
  if (
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    value <= ELLIPSIS_LENGTH
  ) {
    return DEFAULT_MAX_LENGTH;
  }
  return value;
}

function normalizePlainText(value: string): string {
  return stripHtmlTags(value).replace(/\s+/g, ' ').trim();
}

// Unambiguous meta-title separators. A bare hyphen (`-`) is intentionally
// excluded because product names regularly contain internal hyphens
// (e.g. `MacBook-Pro`, `iPhone-256GB`) and treating them as separators
// causes `removeTrailingDuplicateSuffix` to strip legitimate name segments.
// The spaced hyphen ` - ` is handled explicitly below as a separate branch.
const META_TITLE_SEPARATORS = ['|', '–', '—', ':'] as const;
const META_TITLE_SPACED_HYPHEN = ' - ';

function stringsMatchCaseInsensitive(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0;
}

function getTrailingSeparatedSegment(value: string) {
  const trimmedValue = value.trim();

  let bestIndex = -1;
  let separatorLength = 0;

  for (const separator of META_TITLE_SEPARATORS) {
    const index = trimmedValue.lastIndexOf(separator);
    if (index > bestIndex) {
      bestIndex = index;
      separatorLength = separator.length;
    }
  }

  // Spaced hyphen (` - `) is treated as a separator too, but bare hyphens
  // are ignored so product names with internal hyphens aren't mangled.
  const spacedHyphenIndex = trimmedValue.lastIndexOf(META_TITLE_SPACED_HYPHEN);
  if (spacedHyphenIndex > bestIndex) {
    bestIndex = spacedHyphenIndex;
    separatorLength = META_TITLE_SPACED_HYPHEN.length;
  }

  if (bestIndex === -1) {
    return null;
  }

  const base = trimmedValue.slice(0, bestIndex).trim();
  const suffix = trimmedValue.slice(bestIndex + separatorLength).trim();

  if (!base || !suffix) {
    return null;
  }

  return { base, suffix };
}

function removeTrailingDuplicateSuffix(value: string, suffix: string): string {
  const normalizedSuffix = normalizePlainText(suffix);
  if (!normalizedSuffix) {
    return value;
  }

  let normalizedValue = normalizePlainText(value);

  while (true) {
    const trailingSegment = getTrailingSeparatedSegment(normalizedValue);
    if (
      !trailingSegment ||
      !stringsMatchCaseInsensitive(trailingSegment.suffix, normalizedSuffix)
    ) {
      break;
    }

    const nextValue = trailingSegment.base;
    if (!nextValue || nextValue === normalizedValue) {
      break;
    }
    normalizedValue = nextValue;
  }

  return normalizedValue;
}

/**
 * Generates a normalized SEO title with optional suffix and length cap.
 */
export function generateMetaTitle(
  title: string,
  options?: {
    maxLength?: number;
    suffix?: string;
    fallback?: string;
  }
): string {
  const maxLength = validateMaxLength(
    options?.maxLength ?? DEFAULT_TITLE_MAX_LENGTH
  );
  const fallback = normalizePlainText(options?.fallback || '');
  let normalizedTitle = normalizePlainText(title) || fallback;
  const suffix = normalizePlainText(options?.suffix || '');

  if (!normalizedTitle) {
    normalizedTitle = suffix;
  }

  if (!normalizedTitle) {
    return '';
  }

  if (suffix) {
    const baseTitle = removeTrailingDuplicateSuffix(normalizedTitle, suffix);
    const trailingSegment = getTrailingSeparatedSegment(baseTitle);
    const hasSuffix =
      stringsMatchCaseInsensitive(baseTitle, suffix) ||
      (trailingSegment
        ? stringsMatchCaseInsensitive(trailingSegment.suffix, suffix)
        : false);
    normalizedTitle = hasSuffix ? baseTitle : `${baseTitle} | ${suffix}`;
  }

  if (normalizedTitle.length <= maxLength) {
    return normalizedTitle;
  }

  if (suffix) {
    const normalizedSuffix = normalizePlainText(suffix);
    const suffixFragment = ` | ${normalizedSuffix}`;
    if (normalizedTitle.endsWith(suffixFragment)) {
      const baseTitle = normalizedTitle
        .slice(0, normalizedTitle.length - suffixFragment.length)
        .trim();
      const allowedBaseLength =
        maxLength - suffixFragment.length - ELLIPSIS_LENGTH;

      if (allowedBaseLength > 0) {
        return `${baseTitle.slice(0, allowedBaseLength)}${ELLIPSIS}${suffixFragment}`;
      }
    }
  }

  return `${normalizedTitle.slice(0, maxLength - ELLIPSIS_LENGTH)}${ELLIPSIS}`;
}

/**
 * Generates a meta description from product description if not provided
 */
export function generateMetaDescription(
  description: string,
  maxLength: number = DEFAULT_MAX_LENGTH,
  options?: {
    minLength?: number;
    fallback?: string;
  }
): string {
  const validMaxLength = validateMaxLength(maxLength);
  const minLength = Math.max(DEFAULT_MIN_LENGTH, options?.minLength ?? 0);

  const fallbackPlainText = options?.fallback
    ? normalizePlainText(options.fallback)
    : '';

  // Strip HTML tags using iterative sanitization to prevent incomplete removal
  // of nested patterns like <scr<script>ipt>
  const plainText = normalizePlainText(description);

  const baseDescription = plainText || fallbackPlainText;
  if (!baseDescription) {
    return '';
  }

  let candidateDescription = baseDescription;

  if (
    minLength > 0 &&
    candidateDescription.length < minLength &&
    fallbackPlainText
  ) {
    if (candidateDescription !== fallbackPlainText) {
      const normalizedBase = /[.!?]$/.test(candidateDescription)
        ? candidateDescription
        : `${candidateDescription}.`;
      const mergedDescription = `${normalizedBase} ${fallbackPlainText}`.trim();
      candidateDescription =
        mergedDescription.length > candidateDescription.length
          ? mergedDescription
          : candidateDescription;
    }
  }

  if (candidateDescription.length <= validMaxLength) {
    return candidateDescription;
  }

  return (
    candidateDescription.substring(0, validMaxLength - ELLIPSIS_LENGTH) +
    ELLIPSIS
  );
}

/**
 * Generates CollectionPage schema for product listing pages (categories, collections)
 * @see https://schema.org/CollectionPage
 */
export interface CollectionPageData {
  name: string;
  description?: string;
  url: string;
  products: Product[];
  merchantName: string;
  currency?: string;
  country?: string;
  trustProfile?: MerchantTrustProfile;
}

function toAbsoluteSchemaUrl(baseUrl: string, value?: string | null): string {
  if (!value) {
    return '';
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

/**
 * Generates CollectionPage schema for product listing pages (categories, collections).
 * @see https://schema.org/CollectionPage
 */
export function generateCollectionPageSchema(
  data: CollectionPageData
): Record<string, unknown> {
  const safeProducts = data.products.slice(0, 20); // Limit to 20 for performance
  const absolutePageUrl = toAbsoluteSchemaUrl(data.url, data.url);
  const currency = data.currency || 'NGN';
  const country = data.country || 'NG';
  const shippingDetails = buildOfferShippingDetails(
    country,
    currency,
    data.trustProfile
  );
  const hasMerchantReturnPolicy = buildMerchantReturnPolicy(
    country,
    data.trustProfile
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: escapeHtml(data.name),
    description: data.description ? escapeHtml(data.description) : undefined,
    ...(absolutePageUrl && { url: absolutePageUrl }),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: data.products.length,
      itemListElement: safeProducts.map((product, index) => {
        const productUrl = toAbsoluteSchemaUrl(
          data.url,
          getProductUrl(product)
        );
        const productImage = toAbsoluteSchemaUrl(
          data.url,
          product.imageLarge || product.image
        );

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: escapeHtml(product.name),
            description: product.description
              ? escapeHtml(generateMetaDescription(product.description, 100))
              : undefined,
            image: productImage || undefined,
            url: productUrl || undefined,
            brand: {
              '@type': 'Brand',
              name: escapeHtml(product.brand || data.merchantName),
            },
            ...(product.gtin && { gtin: escapeHtml(product.gtin) }),
            ...(product.mpn && { mpn: escapeHtml(product.mpn) }),
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: currency,
              availability: getSchemaAvailability(product),
              url: productUrl || undefined,
              shippingDetails,
              ...(hasMerchantReturnPolicy && { hasMerchantReturnPolicy }),
            },
          },
        };
      }),
    },
  };
}

/**
 * Generates OnlineStore schema for platform and merchant storefront entities
 * @see https://schema.org/OnlineStore
 */
export interface OrganizationData {
  name: string;
  url: string;
  country?: string;
  logo?: string;
  description?: string;
  email?: string;
  telephone?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  foundingDate?: string;
  trustProfile?: MerchantTrustProfile;
}

/**
 * Generates Organization schema for merchant branding and trust.
 * @see https://schema.org/Organization
 */
export function generateOrganizationSchema(
  data: OrganizationData & { trustProfile?: MerchantTrustProfile }
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: escapeHtml(data.name),
    url: escapeHtml(data.url),
  };

  if (data.logo) {
    const safeLogo = escapeHtml(data.logo);
    schema.logo = {
      '@type': 'ImageObject',
      url: safeLogo,
      width: 600,
      height: 60,
    };
    schema.image = safeLogo;
  }

  if (data.description) {
    schema.description = escapeHtml(data.description);
  }

  if (data.email) {
    schema.email = escapeHtml(data.email);
  }

  if (data.telephone) {
    schema.telephone = escapeHtml(data.telephone);
  }

  const foundingDate =
    data.foundingDate ?? data.trustProfile?.foundedYear?.toString();
  if (foundingDate) {
    schema.foundingDate = escapeHtml(foundingDate);
  }

  const sameAs = buildSameAsUrls(data, data.trustProfile);
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  const contactPoint = buildContactPoint(data, data.trustProfile);
  if (contactPoint) {
    schema.contactPoint = contactPoint;
  }

  const hasMerchantReturnPolicy = data.trustProfile?.returnPolicy
    ? buildMerchantReturnPolicy(data.country ?? 'NG', data.trustProfile)
    : undefined;

  if (hasMerchantReturnPolicy) {
    schema.hasMerchantReturnPolicy = hasMerchantReturnPolicy;
  }

  return schema;
}

/**
 * Generates WebSite schema with SearchAction for sitelinks search box
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export function generateWebSiteSchema(
  name: string,
  url: string,
  searchUrlTemplate?: string
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: escapeHtml(name),
    url: escapeHtml(url),
  };

  // Add search action for sitelinks search box
  if (searchUrlTemplate) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: escapeHtml(searchUrlTemplate),
      },
      'query-input': 'required name=search_term_string',
    };
  }

  return schema;
}

/**
 * Generates AggregateRating schema for products with reviews
 * Returns the aggregateRating object to be merged into Product schema
 * @see https://schema.org/AggregateRating
 */
export interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

export interface AggregateRatingSchema {
  '@type': 'AggregateRating';
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

/**
 * Generates AggregateRating schema for products with reviews.
 * Returns the aggregateRating object to be merged into Product schema.
 * @see https://schema.org/AggregateRating
 */
export function generateAggregateRating(
  stats: ReviewStats
): AggregateRatingSchema | null {
  if (!stats.reviewCount || stats.reviewCount === 0) {
    return null;
  }

  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round(stats.averageRating * 10) / 10, // Round to 1 decimal
    reviewCount: stats.reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

/**
 * Constructs a clean canonical URL by removing noisy query parameters.
 * Best practice for 2025: Point to the "clean" version of the URL (without tracking/sorting).
 *
 * @param baseUrl - The absolute base URL (e.g., "https://store.com/products")
 * @param searchParams - The current search parameters object
 * @param allowedParams - List of parameters to KEEP (e.g., ['page', 'q']). All others are stripped.
 */
export function constructCanonicalUrl(
  baseUrl: string,
  searchParams:
    | URLSearchParams
    | { entries(): IterableIterator<[string, string]> }
    | Record<string, string | string[] | undefined>,
  allowedParams: string[] = ['page']
): string {
  // Normalize searchParams to URLSearchParams
  const params = new URLSearchParams();

  if (searchParams) {
    const entries =
      searchParams instanceof URLSearchParams
        ? searchParams.entries()
        : Object.entries(searchParams);

    for (const [key, value] of entries) {
      // Only keep allowed parameters
      if (allowedParams.includes(key)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(key, v);
          }
        } else if (value !== undefined) {
          params.append(key, value as string);
        }
      }
    }
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Blog Post Schema Data
 */
interface BlogPostSchemaData {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageUrls?: string[];
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
    jobTitle?: string;
    description?: string;
  };
  publisher: {
    name: string;
    logo: string;
    url: string;
  };
  wordCount?: number;
  keywords?: string[];
  category?: string;
  readingTime?: number;
}

/**
 * Generate Blog Post Schema (Article)
 */
export function generateBlogPostSchema(
  data: BlogPostSchemaData
): Record<string, unknown> {
  // SECURITY FIX: Sanitize all inputs to prevent XSS (consistent with other schema functions)
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: escapeHtml(data.title),
    description: escapeHtml(data.description),
    url: escapeHtml(data.url),
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: {
      '@type': 'Person',
      name: escapeHtml(data.author.name),
      ...(data.author.url && { url: escapeHtml(data.author.url) }),
      ...(data.author.jobTitle && {
        jobTitle: escapeHtml(data.author.jobTitle),
      }),
      ...(data.author.description && {
        description: escapeHtml(data.author.description),
      }),
    },
    publisher: {
      '@type': 'Organization',
      name: escapeHtml(data.publisher.name),
      url: escapeHtml(data.publisher.url),
      logo: {
        '@type': 'ImageObject',
        url: escapeHtml(data.publisher.logo),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': escapeHtml(data.url),
    },
  };

  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  if (imageUrls.length > 0) {
    schema.image = imageUrls.map((url) => escapeHtml(url));
  } else if (data.image) {
    schema.image = {
      '@type': 'ImageObject',
      url: escapeHtml(data.image),
    };
  }

  if (data.wordCount) {
    schema.wordCount = data.wordCount;
  }

  if (data.keywords && data.keywords.length > 0) {
    // Sanitize each keyword
    schema.keywords = data.keywords.map((k) => escapeHtml(k)).join(', ');
  }

  if (data.category) {
    schema.articleSection = escapeHtml(data.category);
  }

  if (data.readingTime) {
    schema.timeRequired = `PT${data.readingTime}M`;
  }

  return schema;
}
