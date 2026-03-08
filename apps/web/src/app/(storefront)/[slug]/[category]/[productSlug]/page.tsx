import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProductWithDetails,
} from '@/lib/cached-data';
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
import { isDomainIdentifier } from '@/lib/validation';
import ProductDetailClient from '../../products/[productSlug]/product-detail-client';

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
    interface SpecField {
      key: string;
      label: string;
      dynamicLabel?: (specs: KeySpecs) => string;
      // biome-ignore lint/suspicious/noExplicitAny: Value types vary per field
      transform?: (value: any, allSpecs: KeySpecs) => string;
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
            transform: (v: boolean) => (v ? 'Yes' : 'No'),
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
            transform: (v: number) => `${v}g`,
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
            transform: (v: number) => `${v} inches`,
          },
          { key: 'display_resolution', label: 'Resolution' },
          {
            key: 'refresh_rate_hz',
            label: 'Refresh Rate',
            transform: (v: number) => `${v}Hz`,
          },
          {
            key: 'display_ppi',
            label: 'Pixel Density',
            transform: (v: number) => `${v} ppi`,
          },
          {
            key: 'display_peak_brightness',
            label: 'Peak Brightness',
            transform: (v: number) => `${v} nits`,
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
            transform: (v: string) => `Android ${v}`,
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
            transform: (_: string | number | boolean, allSpecs: KeySpecs) =>
              allSpecs.has_card_slot ? allSpecs.card_slot_type || 'Yes' : 'No',
          },
          {
            key: 'storage_gb',
            label: 'Internal Storage',
            transform: (v: number) => `${v}GB`,
          },
          {
            key: 'ram_gb',
            label: 'RAM',
            transform: (v: number) => `${v}GB`,
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
            transform: (v: number) => `${v}MP`,
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
            transform: (v: number) => `${v}MP`,
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
            transform: (v: boolean) =>
              v ? 'Yes, with stereo speakers' : 'Yes (mono)',
          },
          {
            key: 'has_headphone_jack',
            label: '3.5mm Jack',
            transform: (v: boolean) => (v ? 'Yes' : 'No'),
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
            transform: (v: boolean) => (v ? 'Yes' : 'No'),
          },
          {
            key: 'has_fm_radio',
            label: 'Radio',
            transform: (v: boolean) => (v ? 'FM Radio' : 'No'),
          },
          {
            key: 'usb_type',
            label: 'USB',
            transform: (v: string | number | boolean, allSpecs: KeySpecs) =>
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
            transform: (v: string | number | boolean, allSpecs: KeySpecs) =>
              `${v}mAh${allSpecs.battery_removable ? ' (removable)' : ''}`,
          },
          {
            key: 'charging_watt',
            label: 'Wired Charging',
            transform: (v: number) => `${v}W`,
          },
          {
            key: 'wireless_charging_watt',
            label: 'Wireless Charging',
            transform: (v: number) => `${v}W`,
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

  // Derive storage options - check multiple sources
  // Priority: storage_options > variant_attributes.Storage > extracted from variants
  // variant_attributes is consolidated JSONB: {"Storage": ["256GB", "512GB"], "Platform": ["EU"]}
  const variantAttrs = (
    product as { variant_attributes?: Record<string, string[]> }
  ).variant_attributes;
  let storageOptions: string[] = [];

  if (product.storage_options && product.storage_options.length > 0) {
    storageOptions = product.storage_options;
  } else if (variantAttrs?.Storage && variantAttrs.Storage.length > 0) {
    // Consolidated storage from variant_attributes (case-sensitive key)
    storageOptions = variantAttrs.Storage;
  } else if (
    variantAttrs?.storage &&
    (variantAttrs as Record<string, string[]>).storage.length > 0
  ) {
    // Lowercase fallback
    storageOptions = (variantAttrs as Record<string, string[]>).storage;
  } else if (product.variants && product.variants.length > 0) {
    // Extract unique storage values from variants attributes JSONB
    storageOptions = Array.from(
      new Set(
        product.variants
          .map(
            (v: { attributes?: Record<string, string> }) =>
              v.attributes?.storage
          )
          .filter(Boolean) as string[]
      )
    );
  }

  // Compute attributeAxes from variant attributes for dynamic selector rendering
  const attributeAxes: string[] = [];
  if (product.variants && product.variants.length > 0) {
    const axisValueCounts = new Map<string, Set<string>>();
    for (const v of product.variants) {
      if (v.attributes) {
        for (const [key, val] of Object.entries(v.attributes)) {
          if (!axisValueCounts.has(key)) {
            axisValueCounts.set(key, new Set());
          }
          axisValueCounts.get(key)?.add(val);
        }
      }
    }

    // Order: storage, ram, color, platform, then alphabetical remainder
    // Exclude single-value axes (not selectable)
    const priorityOrder = ['storage', 'ram', 'color', 'platform'];
    const sortedKeys = Array.from(axisValueCounts.entries())
      .filter(([, values]) => values.size > 1)
      .sort(([a], [b]) => {
        const aIdx = priorityOrder.indexOf(a);
        const bIdx = priorityOrder.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(([key]) => key);

    attributeAxes.push(...sortedKeys);
  }

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
    variant_attributes: variantAttrs,
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
          typeof o.price === 'string' ? Number.parseFloat(o.price) : o.price
        ),
        rawPrice:
          typeof o.price === 'string' ? Number.parseFloat(o.price) : o.price,
        compare_at_price: o.compare_at_price
          ? formatter.format(
              typeof o.compare_at_price === 'string'
                ? Number.parseFloat(o.compare_at_price)
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

const getProduct = async (
  storeSlug: string,
  categorySlug: string,
  productSlug: string
) => {
  // 1. Get Merchant using cached functions (bypasses RLS, more reliable)
  const merchant = isDomainIdentifier(storeSlug)
    ? await getCachedMerchantByDomain(storeSlug)
    : await getCachedMerchant(storeSlug);

  if (!merchant) {
    console.error('Merchant not found for slug/domain:', storeSlug);
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
    console.error('Product not found:', productSlug);
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
        ? Number.parseFloat(product.price)
        : product.price,
    compare_at_price:
      typeof product.compare_at_price === 'string'
        ? Number.parseFloat(product.compare_at_price)
        : product.compare_at_price,
    manage_stock: product.manage_stock ?? true,
    stock: (() => {
      if (typeof product.stock === 'number') {
        return product.stock;
      }

      if (typeof product.stock === 'string') {
        const parsedStock = Number.parseInt(product.stock, 10);
        if (!Number.isNaN(parsedStock)) {
          return parsedStock;
        }
      }

      return product.stock_quantity ?? 0;
    })(),
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
    variants: product.product_variants || [],
  } as Product;

  const productCategorySlug =
    dbCategorySlug ||
    (product.category ? generateSlug(product.category) : null);

  const categoryMismatch =
    productCategorySlug && productCategorySlug !== categorySlug;

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
  const resolvedSearchParams = await searchParams;
  const result = await getProduct(slug, category, productSlug);

  if (!result?.product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { product, merchant } = result;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  let baseUrl = `${protocol}://${host}`;

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // FIX: Ensure canonical URL always points to the production custom domain if it exists
  if (!isLocalhost && merchant?.custom_domain) {
    baseUrl = `https://${merchant.custom_domain}`;
  }

  const urlPrefix = isLocalhost ? `/${slug}` : '';

  // Construct canonical URL:
  // 1. Use explicit canonical from product data if available
  // 2. OR build the base path using getProductUrl (which handles categories)
  let canonicalUrl = product.canonical_url;

  if (!canonicalUrl) {
    // Generate the correct path (e.g. /category/product)
    const productPath = getProductUrl(product);

    // Construct full URL
    const basePath = `${baseUrl}${urlPrefix}${productPath}`;

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
  const result = await getProduct(slug, category, productSlug);

  if (!result?.product) {
    notFound();
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } = result;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // Strict Canonical URL Enforcement:
  // 1. If we found via case-insensitive fallback -> Redirect to lowercase canonical
  // 2. If the URL category doesn't match the product's actual category -> Redirect
  if (categoryMismatch || needsValuesRedirect) {
    const correctCategorySlug =
      product.category_slug ||
      (product.category ? generateSlug(product.category) : undefined);

    if (correctCategorySlug) {
      const cleanSlug = product.slug || product.id;

      const targetPath = isLocalhost
        ? `/${slug}/${correctCategorySlug}/${cleanSlug}`
        : `/${correctCategorySlug}/${cleanSlug}`;

      permanentRedirect(targetPath as `/${string}`);
    }
  }
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  let baseUrl = `${protocol}://${host}`;

  // FIX: Ensure schema URL always points to the production custom domain if it exists
  if (!isLocalhost && merchant?.custom_domain) {
    baseUrl = `https://${merchant.custom_domain}`;
  }

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
      {/* SEO Content - Server-rendered for crawlers, hidden but accessible and indexable */}
      <article className="sr-only">
        <h1>{product.name}</h1>
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
