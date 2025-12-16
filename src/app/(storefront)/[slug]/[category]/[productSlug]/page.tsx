import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
// Template-specific imports
import { OgabasseyLayout } from '@/components/storefront/ogabassey';
import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import type { Product } from '@/lib/products';
import {
  escapeHtml,
  safeJsonLdStringify,
  sanitizeLikePattern,
} from '@/lib/sanitize-core';
import {
  generateBreadcrumbSchema,
  generateProductSchema,
  generateSlug,
  getProductUrl,
} from '@/lib/seo-utils';
import ProductDetailClient from '../../products/[productSlug]/product-detail-client';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

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
  is_5g?: boolean;
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
            key: 'is_5g',
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

  return {
    id: product.id,
    merchantId: product.merchant_id,
    slug: product.slug,
    name: product.name,
    price: formatter.format(product.price),
    rawPrice: product.price,
    image: product.imageLarge || product.image,
    // Handle both string arrays and object arrays with url property
    images: product.images?.map((img) => typeof img === 'string' ? img : img.url) || [
      product.imageLarge || product.image,
    ].filter(Boolean),
    description: product.description,
    rating: product.rating ?? 0,
    category: product.category || 'General',
    categorySlug: product.category_slug,
    condition: (product.condition || 'new') as OgabasseyProduct['condition'],
    brand: product.brand,
    stock: product.stock,
    detailedSpecs,
    specs,
    // Phase 4: Pass variants to frontend with mapping
    variants:
      product.variants?.map(
        (v: {
          id: string;
          storage?: string;
          ram_gb?: number;
          sku?: string;
          color?: string;
          attributes?: { platform?: string };
          price_override?: number;
          price_modifier?: number;
          stock_quantity?: number;
          images?: string[];
        }) => ({
          id: v.id,
          name:
            `Variant ${v.storage || ''} ${v.ram_gb ? `${v.ram_gb}GB` : ''}`.trim() ||
            v.sku ||
            'Variant',
          storage: v.storage,
          ram: v.ram_gb ? `${v.ram_gb}GB` : undefined,
          color: v.color,
          platform: v.attributes?.platform, // Map platform from JSON attributes
          price_override: v.price_override,
          price_modifier: v.price_modifier, // Map if it exists (but likely undefined in DB now)
          stock: v.stock_quantity,
          images: v.images,
        })
      ) || [],
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
    return (
      <OgabasseyLayout>
        <OgabasseyProductPage product={ogabasseyProduct} />
      </OgabasseyLayout>
    );
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
}

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

const getProduct = cache(
  async (storeSlug: string, categorySlug: string, productSlug: string) => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get Merchant ID from store slug
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, social_media, payout_currency, business_type, template_id'
      )
      .eq('slug', storeSlug)
      .maybeSingle();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return null;
    }

    // 2. Get Product by slug and merchant_id
    // Also verify category matches (for SEO canonical purposes)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        productSlug
      );

    let query = supabase
      .from('products')
      .select(`
        *,
        product_categories (
          categories (
            slug
          )
        ),
        product_key_specs (
          screen_size_inches,
          refresh_rate_hz,
          chipset,
          ram_gb,
          storage_gb,
          main_camera_mp,
          battery_mah,
          charging_watt,
          is_5g,
          android_version,
          network_technology,
          sim_type,
          has_nfc,
          wifi_bands,
          bluetooth_version,
          usb_type,
          has_usb_otg,
          positioning,
          has_fm_radio,
          dimensions_mm,
          weight_g,
          build_materials,
          ip_rating,
          display_type,
          display_resolution,
          display_ppi,
          display_protection,
          display_peak_brightness,
          front_camera_mp,
          front_camera_features,
          front_camera_video,
          rear_camera_features,
          rear_camera_video,
          has_dual_camera,
          has_triple_camera,
          has_quad_camera,
          has_stereo_speakers,
          has_headphone_jack,
          fingerprint_type,
          sensors,
          battery_removable,
          has_wireless_charging,
          wireless_charging_watt,
          has_reverse_charging,
          cpu_cores,
          gpu,
          has_card_slot,
          card_slot_type,
          available_colors,
          model_numbers,
          announced_date,
          release_date
        )
      `)
      .eq('merchant_id', merchant.id);

    if (isUuid) {
      // Validated by isUuid regex, but sanitizing to be safe against injection
      const safeSlug = sanitizeLikePattern(productSlug);
      query = query.or(`slug.eq.${safeSlug},id.eq.${safeSlug}`);
    } else {
      query = query.eq('slug', productSlug);
    }

    const { data: product, error: productError } = await query.maybeSingle();

    if (productError || !product) {
      console.error(
        'Product not found:',
        JSON.stringify(productError, null, 2)
      );
      return null;
    }

    // Verify category matches (optional - for strictness)
    // If category doesn't match, we could redirect to the correct URL
    // For now, we'll just serve the product but use the correct canonical URL
    // Verify category matches (optional - for strictness)
    // We prefer the DB category slug if available, otherwise fallback to generated
    interface ProductWithCategories {
      product_categories?: Array<{ categories?: { slug?: string } }>;
    }
    const productWithCats = product as unknown as ProductWithCategories;
    const dbCategorySlug =
      productWithCats.product_categories?.[0]?.categories?.slug;

    // Create extended product with category_slug to avoid mutation
    const productWithCategorySlug: Product = {
      ...product,
      category_slug: dbCategorySlug,
    } as Product;

    const productCategorySlug =
      dbCategorySlug ||
      (product.category ? generateSlug(product.category) : null);

    const categoryMismatch =
      productCategorySlug && productCategorySlug !== categorySlug;

    // Fetch variants if needed
    if (product.has_variants) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id);

      if (variants) {
        productWithCategorySlug.variants = variants;
      }
    }

    return { product: productWithCategorySlug, categoryMismatch, merchant };
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, category, productSlug } = await params;
  const result = await getProduct(slug, category, productSlug);

  if (!result?.product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
    };
  }

  const { product, merchant } = result;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Build canonical URL using the proper category-based format
  const canonicalPath = getProductUrl(product);
  const canonicalUrl = product.canonical_url || `${baseUrl}${canonicalPath}`;

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
      images: product.images?.length
        ? product.images.map((img) => ({ url: img.url, alt: img.alt }))
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

  const { product, merchant } = result;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Generate product schema (now handles merging custom schema_markup internally)
  const productSchema = generateProductSchema(
    product,
    merchant?.business_name || 'Baci Store',
    merchant?.payout_currency || 'USD'
  );

  // Build proper URL for schema
  const productPath = getProductUrl(product);
  const productUrl = `${baseUrl}${productPath}`;

  if (productSchema.offers && !Array.isArray(productSchema.offers)) {
    productSchema.offers.url = escapeHtml(productUrl);
  }

  // Generate breadcrumb schema with category
  const categoryUrl = product.category
    ? `${baseUrl}/${generateSlug(product.category)}`
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
      <Suspense fallback={<ProductDetailSkeleton />}>
        <TemplateProductPage
          product={product}
          templateId={merchant?.template_id}
        />
      </Suspense>
    </>
  );
}
