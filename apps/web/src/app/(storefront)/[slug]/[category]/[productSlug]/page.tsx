import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import ProductDetailClient from '@/app/(storefront)/[slug]/products/[productSlug]/product-detail-client';
import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import type { VariantAttributeSource } from '@/components/storefront/ogabassey/variant-attributes';
import {
  getRenderableVariantAxes,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from '@/components/storefront/ogabassey/variant-attributes';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
  type CachedLegacyProductRedirectTarget,
  type CachedMerchant,
  getCachedLegacyProductRedirectTarget,
  getCachedProductWithDetails,
  getRequestScopedMerchant,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product } from '@/lib/products';
import { escapeHtml } from '@/lib/sanitize-core';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  constructCanonicalUrl,
  generateBreadcrumbSchema,
  generateProductSchema,
  generateSlug,
  getProductUrl,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';
import { isValidMerchantIdentifier } from '@/lib/validation';

/** KeySpecs interface for product_key_specs */
interface KeySpecs {
  screen_size_inches?: number;
  refresh_rate_hz?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  battery_mah?: number;
  charging_watt?: number;
  has_5g?: boolean;
  android_version?: string;
  network_technology?: string;
  sim_type?: string;
  has_nfc?: boolean;
  wifi_bands?: string;
  bluetooth_version?: string;
  usb_type?: string;
  has_usb_otg?: boolean;
  positioning?: string;
  has_fm_radio?: boolean;
  dimensions_mm?: string;
  weight_g?: number;
  build_materials?: string;
  ip_rating?: string;
  display_type?: string;
  display_resolution?: string;
  display_ppi?: number;
  display_protection?: string;
  display_peak_brightness?: number;
  front_camera_mp?: number;
  front_camera_features?: string;
  front_camera_video?: string;
  rear_camera_features?: string;
  rear_camera_video?: string;
  has_dual_camera?: boolean;
  has_triple_camera?: boolean;
  has_quad_camera?: boolean;
  has_stereo_speakers?: boolean;
  has_headphone_jack?: boolean;
  fingerprint_type?: string;
  sensors?: string;
  battery_removable?: boolean;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;
  has_reverse_charging?: boolean;
  cpu_cores?: string;
  gpu?: string;
  has_card_slot?: boolean;
  card_slot_type?: string;
  available_colors?: string;
  model_numbers?: string;
  announced_date?: string;
  release_date?: string;
  [key: string]: string | number | boolean | undefined;
}

/** Product with key specs for type safety */
interface ProductWithKeySpecs {
  product_key_specs?: KeySpecs;
}

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

  // Transform product_key_specs into detailedSpecs format
  const productWithSpecs = product as unknown as ProductWithKeySpecs;
  const keySpecs = productWithSpecs.product_key_specs;
  let detailedSpecs: {
    category: string;
    items: { label: string; value: string }[];
  }[] = [];
  let specs: { label: string; value: string }[] = [];

  if (keySpecs && !Array.isArray(keySpecs)) {
    // Build specs array
    const specsArray: { label: string; value: string }[] = [];

    if (keySpecs.screen_size_inches) {
      specsArray.push({
        label: 'Display',
        value: `${keySpecs.screen_size_inches}"`,
      });
    }
    if (keySpecs.ram_gb) {
      specsArray.push({ label: 'RAM', value: `${keySpecs.ram_gb}GB` });
    }
    if (keySpecs.storage_gb) {
      specsArray.push({ label: 'Storage', value: `${keySpecs.storage_gb}GB` });
    }
    if (keySpecs.main_camera_mp) {
      specsArray.push({
        label: 'Camera',
        value: `${keySpecs.main_camera_mp}MP`,
      });
    }
    if (keySpecs.battery_mah) {
      specsArray.push({
        label: 'Battery',
        value: `${keySpecs.battery_mah}mAh`,
      });
    }

    specs = specsArray;

    // Configuration for spec categories
    /** Possible value type from KeySpecs index signature */
    type KeySpecValue = string | number | boolean | undefined;

    interface SpecField {
      key: string;
      label: string;
      dynamicLabel?: (specs: KeySpecs) => string;
      transform?: (value: KeySpecValue, allSpecs: KeySpecs) => string;
      condition?: (specs: KeySpecs) => boolean;
    }

    interface SpecCategory {
      category: string;
      fields: SpecField[];
    }

    const specCategories: SpecCategory[] = [
      {
        category: 'Network',
        fields: [
          { key: 'network_technology', label: 'Technology' },
          {
            key: 'has_5g',
            label: '5G Support',
            transform: (v) => (v ? 'Yes' : 'No'),
          },
        ],
      },
      {
        category: 'Body',
        fields: [
          { key: 'dimensions_mm', label: 'Dimensions' },
          {
            key: 'weight_g',
            label: 'Weight',
            transform: (v) => `${v}g`,
          },
          { key: 'build_materials', label: 'Build' },
          { key: 'sim_type', label: 'SIM' },
          { key: 'ip_rating', label: 'Protection' },
        ],
      },
      {
        category: 'Display',
        fields: [
          { key: 'display_type', label: 'Type' },
          {
            key: 'screen_size_inches',
            label: 'Size',
            transform: (v) => `${v} inches`,
          },
          { key: 'display_resolution', label: 'Resolution' },
          {
            key: 'refresh_rate_hz',
            label: 'Refresh Rate',
            transform: (v) => `${v}Hz`,
          },
          {
            key: 'display_ppi',
            label: 'Pixel Density',
            transform: (v) => `${v} ppi`,
          },
          {
            key: 'display_peak_brightness',
            label: 'Peak Brightness',
            transform: (v) => `${v} nits`,
          },
          { key: 'display_protection', label: 'Protection' },
        ],
      },
      {
        category: 'Platform',
        fields: [
          {
            key: 'android_version',
            label: 'OS',
            transform: (v) => `Android ${v}`,
          },
          { key: 'chipset', label: 'Chipset' },
          { key: 'cpu_cores', label: 'CPU' },
          { key: 'gpu', label: 'GPU' },
        ],
      },
      {
        category: 'Memory',
        fields: [
          {
            key: 'has_card_slot',
            label: 'Card Slot',
            transform: (_v, allSpecs) =>
              allSpecs.has_card_slot ? allSpecs.card_slot_type || 'Yes' : 'No',
          },
          {
            key: 'storage_gb',
            label: 'Internal Storage',
            transform: (v) => `${v}GB`,
          },
          {
            key: 'ram_gb',
            label: 'RAM',
            transform: (v) => `${v}GB`,
          },
        ],
      },
      {
        category: 'Main Camera',
        fields: [
          {
            key: 'main_camera_mp',
            label: 'Camera',
            dynamicLabel: (allSpecs: KeySpecs) =>
              allSpecs.has_quad_camera
                ? 'Quad Camera'
                : allSpecs.has_triple_camera
                  ? 'Triple Camera'
                  : allSpecs.has_dual_camera
                    ? 'Dual Camera'
                    : 'Single Camera',
            transform: (v) => `${v}MP`,
          },
          { key: 'rear_camera_features', label: 'Features' },
          { key: 'rear_camera_video', label: 'Video' },
        ],
      },
      {
        category: 'Selfie Camera',
        fields: [
          {
            key: 'front_camera_mp',
            label: 'Resolution',
            transform: (v) => `${v}MP`,
          },
          { key: 'front_camera_features', label: 'Features' },
          { key: 'front_camera_video', label: 'Video' },
        ],
      },
      {
        category: 'Sound',
        fields: [
          {
            key: 'has_stereo_speakers',
            label: 'Loudspeaker',
            transform: (v) => (v ? 'Yes, with stereo speakers' : 'Yes (mono)'),
          },
          {
            key: 'has_headphone_jack',
            label: '3.5mm Jack',
            transform: (v) => (v ? 'Yes' : 'No'),
          },
        ],
      },
      {
        category: 'Connectivity',
        fields: [
          { key: 'wifi_bands', label: 'WLAN' },
          { key: 'bluetooth_version', label: 'Bluetooth' },
          { key: 'positioning', label: 'Positioning' },
          {
            key: 'has_nfc',
            label: 'NFC',
            transform: (v) => (v ? 'Yes' : 'No'),
          },
          {
            key: 'has_fm_radio',
            label: 'Radio',
            transform: (v) => (v ? 'FM Radio' : 'No'),
          },
          {
            key: 'usb_type',
            label: 'USB',
            transform: (v, allSpecs) =>
              String(v) + (allSpecs.has_usb_otg ? ', OTG' : ''),
          },
        ],
      },
      {
        category: 'Features',
        fields: [
          { key: 'fingerprint_type', label: 'Fingerprint' },
          { key: 'sensors', label: 'Sensors' },
        ],
      },
      {
        category: 'Battery',
        fields: [
          {
            key: 'battery_mah',
            label: 'Capacity',
            transform: (v, allSpecs) =>
              `${v}mAh${allSpecs.battery_removable ? ' (removable)' : ''}`,
          },
          {
            key: 'charging_watt',
            label: 'Wired Charging',
            transform: (v) => `${v}W`,
          },
          {
            key: 'wireless_charging_watt',
            label: 'Wireless Charging',
            transform: (v) => `${v}W`,
            condition: (allSpecs: KeySpecs) => !!allSpecs.has_wireless_charging,
          },
          {
            key: 'has_reverse_charging',
            label: 'Reverse Charging',
            transform: () => 'Yes',
            condition: (allSpecs: KeySpecs) => !!allSpecs.has_reverse_charging,
          },
        ],
      },
      {
        category: 'Misc',
        fields: [
          { key: 'available_colors', label: 'Colors' },
          { key: 'model_numbers', label: 'Models' },
        ],
      },
    ];

    // Build the specs
    detailedSpecs = specCategories
      .map(({ category, fields }) => ({
        category,
        items: fields
          .filter(
            ({ key, condition }) =>
              keySpecs[key] !== null &&
              keySpecs[key] !== undefined &&
              (!condition || condition(keySpecs))
          )
          .map((field) => {
            const value = keySpecs[field.key];
            return {
              label: field.dynamicLabel
                ? field.dynamicLabel(keySpecs)
                : field.label,
              value: field.transform
                ? field.transform(value, keySpecs)
                : String(value),
            };
          }),
      }))
      .filter((cat) => cat.items.length > 0);
  }

  // Fallback to old specifications format if no product_key_specs
  if (detailedSpecs.length === 0 && product.specifications) {
    // biome-ignore lint/suspicious/noExplicitAny: Legacy specifications format is untyped
    detailedSpecs = (product.specifications as any) || [];
    // biome-ignore lint/suspicious/noExplicitAny: Legacy specifications format is untyped
    specs = (product.specifications as any)?.[0]?.items || [];
  }

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

/**
 * Template-aware product page component
 * Renders the correct template's product page based on merchant's template_id
 */
function TemplateProductPage({
  product,
  templateId,
}: {
  product: Product;
  templateId?: string;
}) {
  // Ogabassey template
  if (templateId === 'ogabassey') {
    const ogabasseyProduct = toOgabasseyProduct(product);
    return <OgabasseyProductPage product={ogabasseyProduct} />;
  }

  // Default: use the generic product detail client
  return <ProductDetailClient product={product} />;
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

  // Create extended product with category info
  const productWithCategorySlug: Product = {
    ...product,
    description: product.description || '',
    price:
      typeof product.price === 'string'
        ? Number.parseFloat(product.price) || 0
        : product.price,
    compare_at_price:
      typeof product.compare_at_price === 'string'
        ? Number.parseFloat(product.compare_at_price) || undefined
        : product.compare_at_price,
    manage_stock: product.manage_stock ?? true,
    stock: getEffectiveStock(product),
    image: primaryImage,
    imageLarge: primaryImage,
    imageHint: product.imageHint || product.name,
    images: normalizedImages,
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

  const categoryMismatch = Boolean(
    productCategorySlug && productCategorySlug !== categorySlug
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

  const baseUrl = buildStoreUrl(merchant);

  // Construct canonical URL:
  // 1. Use explicit canonical from product data if available
  // 2. OR build the base path using getProductUrl (which handles categories)
  let canonicalUrl = product.canonical_url;

  if (!canonicalUrl) {
    // Generate the correct path (e.g. /category/product)
    const productPath = getProductUrl(product);

    // Construct full URL
    const basePath = `${baseUrl}${productPath}`;

    // Clean params for canonical
    // We import constructCanonicalUrl from seo-utils
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
      images: product.images?.length
        ? product.images.map((img) => ({
            url: typeof img === 'string' ? img : img.url,
            alt:
              typeof img === 'string' ? product.name : img.alt || product.name,
          }))
        : [
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

export default async function CategoryProductPage({ params }: PageProps) {
  const { slug, category, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }
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

  const baseUrl = buildStoreUrl(merchant);

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    product,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD',
    merchant?.country || 'NG',
    merchant?.logo_url
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
      <Suspense fallback={<ProductDetailSkeleton />}>
        <TemplateProductPage
          product={product}
          templateId={merchant?.template_id}
        />
      </Suspense>
    </>
  );
}
