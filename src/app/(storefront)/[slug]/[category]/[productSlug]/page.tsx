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
  const keySpecs = (product as any).product_key_specs;
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

    // Build detailedSpecs with comprehensive GSM Arena-level categories
    detailedSpecs = [
      // NETWORK
      {
        category: 'Network',
        items: [
          ...(keySpecs.network_technology
            ? [{ label: 'Technology', value: keySpecs.network_technology }]
            : []),
          ...(keySpecs.is_5g !== null && keySpecs.is_5g !== undefined
            ? [{ label: '5G Support', value: keySpecs.is_5g ? 'Yes' : 'No' }]
            : []),
        ].filter(Boolean),
      },
      // BODY
      {
        category: 'Body',
        items: [
          ...(keySpecs.dimensions_mm
            ? [{ label: 'Dimensions', value: keySpecs.dimensions_mm }]
            : []),
          ...(keySpecs.weight_g
            ? [{ label: 'Weight', value: `${keySpecs.weight_g}g` }]
            : []),
          ...(keySpecs.build_materials
            ? [{ label: 'Build', value: keySpecs.build_materials }]
            : []),
          ...(keySpecs.sim_type
            ? [{ label: 'SIM', value: keySpecs.sim_type }]
            : []),
          ...(keySpecs.ip_rating
            ? [{ label: 'Protection', value: keySpecs.ip_rating }]
            : []),
        ].filter(Boolean),
      },
      // DISPLAY
      {
        category: 'Display',
        items: [
          ...(keySpecs.display_type
            ? [{ label: 'Type', value: keySpecs.display_type }]
            : []),
          ...(keySpecs.screen_size_inches
            ? [
                {
                  label: 'Size',
                  value: `${keySpecs.screen_size_inches} inches`,
                },
              ]
            : []),
          ...(keySpecs.display_resolution
            ? [{ label: 'Resolution', value: keySpecs.display_resolution }]
            : []),
          ...(keySpecs.refresh_rate_hz
            ? [
                {
                  label: 'Refresh Rate',
                  value: `${keySpecs.refresh_rate_hz}Hz`,
                },
              ]
            : []),
          ...(keySpecs.display_ppi
            ? [{ label: 'Pixel Density', value: `${keySpecs.display_ppi} ppi` }]
            : []),
          ...(keySpecs.display_peak_brightness
            ? [
                {
                  label: 'Peak Brightness',
                  value: `${keySpecs.display_peak_brightness} nits`,
                },
              ]
            : []),
          ...(keySpecs.display_protection
            ? [{ label: 'Protection', value: keySpecs.display_protection }]
            : []),
        ].filter(Boolean),
      },
      // PLATFORM
      {
        category: 'Platform',
        items: [
          ...(keySpecs.android_version
            ? [{ label: 'OS', value: `Android ${keySpecs.android_version}` }]
            : []),
          ...(keySpecs.chipset
            ? [{ label: 'Chipset', value: keySpecs.chipset }]
            : []),
          ...(keySpecs.cpu_cores
            ? [{ label: 'CPU', value: keySpecs.cpu_cores }]
            : []),
          ...(keySpecs.gpu ? [{ label: 'GPU', value: keySpecs.gpu }] : []),
        ].filter(Boolean),
      },
      // MEMORY
      {
        category: 'Memory',
        items: [
          ...(keySpecs.has_card_slot !== null &&
          keySpecs.has_card_slot !== undefined
            ? [
                {
                  label: 'Card Slot',
                  value: keySpecs.has_card_slot
                    ? keySpecs.card_slot_type || 'Yes'
                    : 'No',
                },
              ]
            : []),
          ...(keySpecs.storage_gb
            ? [{ label: 'Internal Storage', value: `${keySpecs.storage_gb}GB` }]
            : []),
          ...(keySpecs.ram_gb
            ? [{ label: 'RAM', value: `${keySpecs.ram_gb}GB` }]
            : []),
        ].filter(Boolean),
      },
      // MAIN CAMERA
      {
        category: 'Main Camera',
        items: [
          ...(keySpecs.main_camera_mp
            ? [
                {
                  label: keySpecs.has_quad_camera
                    ? 'Quad Camera'
                    : keySpecs.has_triple_camera
                      ? 'Triple Camera'
                      : keySpecs.has_dual_camera
                        ? 'Dual Camera'
                        : 'Single Camera',
                  value: `${keySpecs.main_camera_mp}MP`,
                },
              ]
            : []),
          ...(keySpecs.rear_camera_features
            ? [{ label: 'Features', value: keySpecs.rear_camera_features }]
            : []),
          ...(keySpecs.rear_camera_video
            ? [{ label: 'Video', value: keySpecs.rear_camera_video }]
            : []),
        ].filter(Boolean),
      },
      // SELFIE CAMERA
      {
        category: 'Selfie Camera',
        items: [
          ...(keySpecs.front_camera_mp
            ? [{ label: 'Resolution', value: `${keySpecs.front_camera_mp}MP` }]
            : []),
          ...(keySpecs.front_camera_features
            ? [{ label: 'Features', value: keySpecs.front_camera_features }]
            : []),
          ...(keySpecs.front_camera_video
            ? [{ label: 'Video', value: keySpecs.front_camera_video }]
            : []),
        ].filter(Boolean),
      },
      // SOUND
      {
        category: 'Sound',
        items: [
          ...(keySpecs.has_stereo_speakers !== null &&
          keySpecs.has_stereo_speakers !== undefined
            ? [
                {
                  label: 'Loudspeaker',
                  value: keySpecs.has_stereo_speakers
                    ? 'Yes, with stereo speakers'
                    : 'Yes (mono)',
                },
              ]
            : []),
          ...(keySpecs.has_headphone_jack !== null &&
          keySpecs.has_headphone_jack !== undefined
            ? [
                {
                  label: '3.5mm Jack',
                  value: keySpecs.has_headphone_jack ? 'Yes' : 'No',
                },
              ]
            : []),
        ].filter(Boolean),
      },
      // CONNECTIVITY
      {
        category: 'Connectivity',
        items: [
          ...(keySpecs.wifi_bands
            ? [{ label: 'WLAN', value: keySpecs.wifi_bands }]
            : []),
          ...(keySpecs.bluetooth_version
            ? [{ label: 'Bluetooth', value: keySpecs.bluetooth_version }]
            : []),
          ...(keySpecs.positioning
            ? [{ label: 'Positioning', value: keySpecs.positioning }]
            : []),
          ...(keySpecs.has_nfc !== null && keySpecs.has_nfc !== undefined
            ? [{ label: 'NFC', value: keySpecs.has_nfc ? 'Yes' : 'No' }]
            : []),
          ...(keySpecs.has_fm_radio !== null &&
          keySpecs.has_fm_radio !== undefined
            ? [
                {
                  label: 'Radio',
                  value: keySpecs.has_fm_radio ? 'FM Radio' : 'No',
                },
              ]
            : []),
          ...(keySpecs.usb_type
            ? [
                {
                  label: 'USB',
                  value:
                    keySpecs.usb_type + (keySpecs.has_usb_otg ? ', OTG' : ''),
                },
              ]
            : []),
        ].filter(Boolean),
      },
      // FEATURES
      {
        category: 'Features',
        items: [
          ...(keySpecs.fingerprint_type
            ? [{ label: 'Fingerprint', value: keySpecs.fingerprint_type }]
            : []),
          ...(keySpecs.sensors
            ? [{ label: 'Sensors', value: keySpecs.sensors }]
            : []),
        ].filter(Boolean),
      },
      // BATTERY
      {
        category: 'Battery',
        items: [
          ...(keySpecs.battery_mah
            ? [
                {
                  label: 'Capacity',
                  value: `${keySpecs.battery_mah}mAh${keySpecs.battery_removable ? ' (removable)' : ''}`,
                },
              ]
            : []),
          ...(keySpecs.charging_watt
            ? [{ label: 'Wired Charging', value: `${keySpecs.charging_watt}W` }]
            : []),
          ...(keySpecs.has_wireless_charging && keySpecs.wireless_charging_watt
            ? [
                {
                  label: 'Wireless Charging',
                  value: `${keySpecs.wireless_charging_watt}W`,
                },
              ]
            : []),
          ...(keySpecs.has_reverse_charging !== null &&
          keySpecs.has_reverse_charging !== undefined &&
          keySpecs.has_reverse_charging
            ? [{ label: 'Reverse Charging', value: 'Yes' }]
            : []),
        ].filter(Boolean),
      },
      // MISC
      {
        category: 'Misc',
        items: [
          ...(keySpecs.available_colors
            ? [{ label: 'Colors', value: keySpecs.available_colors }]
            : []),
          ...(keySpecs.model_numbers
            ? [{ label: 'Models', value: keySpecs.model_numbers }]
            : []),
        ].filter(Boolean),
      },
    ].filter((cat) => cat.items.length > 0);
  }

  // Fallback to old specifications format if no product_key_specs
  if (detailedSpecs.length === 0 && product.specifications) {
    detailedSpecs = (product.specifications as any) || [];
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
    images: product.images?.map((img) => img.url) || [
      product.imageLarge || product.image,
    ],
    description: product.description,
    rating: product.rating || 4.5,
    category: product.category || 'General',
    categorySlug: product.category_slug,
    condition: (product.condition || 'new') as OgabasseyProduct['condition'],
    brand: product.brand,
    stock: product.stock,
    detailedSpecs,
    specs,
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
      .single();

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

    const { data: product, error: productError } = await query.single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return null;
    }

    // Verify category matches (optional - for strictness)
    // If category doesn't match, we could redirect to the correct URL
    // For now, we'll just serve the product but use the correct canonical URL
    // Verify category matches (optional - for strictness)
    // We prefer the DB category slug if available, otherwise fallback to generated
    const dbCategorySlug = (product as any).product_categories?.[0]?.categories
      ?.slug;

    // Attach to product object for seo-utils
    (product as any).category_slug = dbCategorySlug;

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
        product.variants = variants;
      }
    }

    return { product: product as Product, categoryMismatch, merchant };
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

  if (productSchema.offers) {
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
