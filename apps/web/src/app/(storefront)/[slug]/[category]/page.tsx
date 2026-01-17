import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { CATEGORY_SEO_DEFAULTS } from '@/config/category-seo-defaults';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import type { Product } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateFAQSchema,
} from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';

// Enable ISR with 5 minute revalidation
// Removed explicit revalidate export to support Dynamic IO

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, category } = await params;

  // 1. Get Merchant
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    return {
      title: 'Store Not Found',
    };
  }

  const data = await getCachedCategoryPageData(merchant.id, category, slug);

  // Helper to resolve SEO data
  const getSeoData = () => {
    if (data.isCollection)
      return (
        data.seo || { heading: '', description: '', features: [], faqs: [] }
      );

    // Logic for category pages
    const categoryName = data.fallbackName || '';
    const categoryDescription = data.fallbackDescription || '';

    const normalizedSlug = category.toLowerCase();
    const defaultConfig = CATEGORY_SEO_DEFAULTS[normalizedSlug] || null;
    const fallbackConfig = !defaultConfig
      ? Object.entries(CATEGORY_SEO_DEFAULTS).find(([key]) =>
          normalizedSlug.includes(key)
        )?.[1]
      : null;
    const effectiveConfig = defaultConfig || fallbackConfig;

    return {
      heading:
        data.category?.seo_heading || effectiveConfig?.heading || categoryName,
      description:
        data.category?.seo_description ||
        effectiveConfig?.description ||
        categoryDescription,
      features: data.category?.seo_features || effectiveConfig?.features || [],
      faqs: data.category?.seo_faq || effectiveConfig?.faqs || [],
    };
  };

  const seoData = getSeoData();
  const categoryName = data.isCollection
    ? data.name
    : data.fallbackName || category;
  const products = data.products as unknown as Product[];

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const categoryUrl = `${baseUrl}/${category}`;

  const title = `${categoryName} | ${merchant.business_name}`;
  const description =
    seoData.description ||
    `Shop ${categoryName} at ${merchant.business_name}. ${products.length} products available.`;

  return {
    title,
    description,
    alternates: {
      canonical: categoryUrl,
    },
    openGraph: {
      title,
      description,
      url: categoryUrl,
      type: 'website',
      siteName: merchant.business_name,
      ...(products.length > 0 &&
        products[0].images?.[0] && {
          images: [
            {
              url: products[0].images[0] as unknown as string,
              alt: categoryName,
            },
          ],
        }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CategoryPageRoute({ params }: PageProps) {
  const { slug, category } = await params;

  // 1. Get Merchant
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const data = await getCachedCategoryPageData(merchant.id, category, slug);
  const products = data.products as unknown as Product[];

  // Helper to resolve SEO data (Same as metadata)
  const getSeoData = () => {
    if (data.isCollection)
      return (
        data.seo || { heading: '', description: '', features: [], faqs: [] }
      );

    const categoryName = data.fallbackName || '';
    const categoryDescription = data.fallbackDescription || '';

    const normalizedSlug = category.toLowerCase();
    const defaultConfig = CATEGORY_SEO_DEFAULTS[normalizedSlug] || null;
    const fallbackConfig = !defaultConfig
      ? Object.entries(CATEGORY_SEO_DEFAULTS).find(([key]) =>
          normalizedSlug.includes(key)
        )?.[1]
      : null;
    const effectiveConfig = defaultConfig || fallbackConfig;

    return {
      heading:
        data.category?.seo_heading || effectiveConfig?.heading || categoryName,
      description:
        data.category?.seo_description ||
        effectiveConfig?.description ||
        categoryDescription,
      features: data.category?.seo_features || effectiveConfig?.features || [],
      faqs: data.category?.seo_faq || effectiveConfig?.faqs || [],
    };
  };

  const seoData = getSeoData();
  const categoryName = data.isCollection
    ? data.name
    : data.fallbackName || category;

  // Read theme cookie server-side for SSR consistency
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;

  const _initialTheme: V2ThemeMode | undefined =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : undefined;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const categoryUrl = `${baseUrl}/${category}`;

  // Generate CollectionPage schema
  const collectionSchema = generateCollectionPageSchema({
    name: categoryName,
    description: seoData.description,
    url: categoryUrl,
    products: products,
    merchantName: merchant.business_name,
    currency: merchant.payout_currency || 'NGN',
  });

  // Generate BreadcrumbList schema (Hierarchical)
  const breadcrumbItems = [{ name: merchant.business_name, url: baseUrl }];

  // Add parent category if exists
  const parent = data.category?.parent as unknown as {
    name: string;
    slug: string;
  } | null;
  if (!data.isCollection && parent) {
    breadcrumbItems.push({
      name: parent.name,
      url: `${baseUrl}/${parent.slug}`,
    });
  }

  // Add current category
  breadcrumbItems.push({
    name: categoryName,
    url: `${baseUrl}/${category}`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  // Generate FAQPage schema if FAQs exist
  const faqSchema =
    seoData.faqs && seoData.faqs.length > 0
      ? generateFAQSchema(seoData.faqs)
      : null;

  return (
    <>
      {/* CollectionPage Schema */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(collectionSchema),
        }}
      />
      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />
      {/* FAQPage Schema */}
      {faqSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
        />
      )}

      <Suspense fallback={<ProductGridSkeleton />}>
        <OgabasseyCategoryPage
          seoHeading={seoData.heading}
          seoDescription={seoData.description || ''}
          seoFeatures={seoData.features}
          seoFaqs={seoData.faqs}
          categoryImage={
            !data.isCollection ? data.category?.image_url : undefined
          }
          products={products.map((p) => {
            // Use unified normalizeProduct for consistent data extraction
            const normalized = normalizeProduct(p as unknown as RawDbProduct);
            // Map condition to expected enum values
            const conditionMap: Record<string, 'New' | 'Used' | 'Open Box'> = {
              New: 'New',
              new: 'New',
              Used: 'Used',
              used: 'Used',
              'Open Box': 'Open Box',
              open_box: 'Open Box',
            };
            return {
              id: normalized.id,
              name: normalized.name,
              slug: normalized.slug,
              description: normalized.description,
              price: `₦${normalized.price.toLocaleString()}`,
              rawPrice: normalized.price,
              image: normalized.image,
              images: normalized.images,
              category: normalized.category,
              brand: normalized.brand ?? undefined,
              condition: conditionMap[normalized.condition] || 'New',
              stock: normalized.stock,
            };
          })}
        />
      </Suspense>
    </>
  );
}
