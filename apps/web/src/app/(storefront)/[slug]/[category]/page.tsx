import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { CATEGORY_SEO_DEFAULTS } from '@/config/category-seo-defaults';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import type { Product } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateFAQSchema,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { isDomainIdentifier } from '@/lib/validation';

// Enable ISR with 5 minute revalidation
// Removed explicit revalidate export to support Dynamic IO

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

type CategoryPageData = Awaited<ReturnType<typeof getCachedCategoryPageData>>;

function getSeoData(data: CategoryPageData, categorySlug: string) {
  if (data.isCollection)
    return data.seo || { heading: '', description: '', features: [], faqs: [] };

  const categoryName = data.fallbackName || '';
  const categoryDescription = data.fallbackDescription || '';

  const normalizedSlug = categorySlug.toLowerCase();
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
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug, category } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = parseStorefrontPageParam(resolvedSearchParams.page);

  if (!currentPage) {
    notFound();
  }

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

  const seoData = getSeoData(data, category);
  const categoryName = data.isCollection
    ? data.name
    : data.fallbackName || category;
  const products = data.products as unknown as Product[];
  const totalPages = Math.max(
    1,
    Math.ceil(products.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );
  const pageStartIndex = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;
  const paginatedProducts = products.slice(
    pageStartIndex,
    pageStartIndex + STOREFRONT_PRODUCTS_PER_PAGE
  );

  if (currentPage > totalPages) {
    notFound();
  }

  const baseUrl = buildStoreUrl(merchant);
  const categoryUrl = `${baseUrl}/${category}`;
  const paginatedCategoryUrl =
    currentPage > 1 ? `${categoryUrl}?page=${currentPage}` : categoryUrl;

  const title =
    currentPage > 1
      ? `${categoryName} - Page ${currentPage} | ${merchant.business_name}`
      : `${categoryName} | ${merchant.business_name}`;
  const description =
    seoData.description ||
    `Shop ${categoryName} at ${merchant.business_name}. ${products.length} products available.`;
  const firstProductImage = paginatedProducts[0]
    ? normalizeProduct(paginatedProducts[0] as unknown as RawDbProduct).image
    : null;
  const socialImageCandidates = [firstProductImage, merchant.logo_url];

  return {
    title,
    description,
    alternates: {
      canonical: paginatedCategoryUrl,
    },
    openGraph: {
      title,
      description,
      url: paginatedCategoryUrl,
      type: 'website',
      siteName: merchant.business_name,
      images: getStorefrontOpenGraphImages(
        baseUrl,
        categoryName,
        ...socialImageCandidates
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: getStorefrontTwitterImages(baseUrl, ...socialImageCandidates),
    },
  };
}

export default function CategoryPageRoute(props: PageProps) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CategoryPageContent {...props} />
    </Suspense>
  );
}

async function CategoryPageContent({ params, searchParams }: PageProps) {
  const { slug, category } = await params;
  const { page } = await searchParams;
  const currentPage = parseStorefrontPageParam(page);

  if (!currentPage) {
    notFound();
  }

  // Lowercase enforcement moved to proxy (prefix normalization + storefront lowercase redirect)

  // 1. Get Merchant
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const data = await getCachedCategoryPageData(merchant.id, category, slug);
  const products = data.products as unknown as Product[];
  const totalPages = Math.max(
    1,
    Math.ceil(products.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );
  const pageStartIndex = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;
  const paginatedProducts = products.slice(
    pageStartIndex,
    pageStartIndex + STOREFRONT_PRODUCTS_PER_PAGE
  );

  if (currentPage > totalPages) {
    notFound();
  }

  const seoData = getSeoData(data, category);
  const categoryName = data.isCollection
    ? data.name
    : data.fallbackName || category;

  const baseUrl = buildStoreUrl(merchant);
  const categoryUrl = `${baseUrl}/${category}`;
  const paginatedCategoryUrl =
    currentPage > 1 ? `${categoryUrl}?page=${currentPage}` : categoryUrl;

  // Generate CollectionPage schema
  const collectionSchema = generateCollectionPageSchema({
    name: categoryName,
    description: seoData.description,
    url: paginatedCategoryUrl,
    products: paginatedProducts,
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
          currentPage={currentPage}
          categoryImage={
            !data.isCollection ? data.category?.image_url : undefined
          }
          itemsPerPage={STOREFRONT_PRODUCTS_PER_PAGE}
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
