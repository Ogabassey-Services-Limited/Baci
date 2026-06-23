import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CatalogListingLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import {
  generateMetaDescription,
  generateMetaTitle,
  getCanonicalStorefrontFilterSearchParams,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  buildStorefrontPageHref,
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { isDomainIdentifier } from '@/lib/validation';
import { CategoryPageContent } from './category-page-content';
import {
  buildCategoryPageHubModel,
  normalizeCategoryPageProducts,
  resolveCategoryPageName,
} from './category-page-content-helpers';

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildCategoryNotFoundMetadata(
  title = 'Category not found',
  description = 'This category is unavailable or has moved.'
): Metadata {
  return {
    title,
    description,
    // Replace root metadata alternates so soft-404 pages do not inherit a canonical.
    alternates: null,
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
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
    return buildCategoryNotFoundMetadata(
      'Category page not found',
      'This category page is unavailable or has moved.'
    );
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

  if (!data.isCollection && data.isInactiveCategory) {
    return buildCategoryNotFoundMetadata();
  }

  // Doorway-trap stopgap (crawl-budget): a genuinely unknown/typo CATEGORY slug
  // resolves to no collection, no category row, and no fuzzy-matched products.
  // Return explicit noindex metadata so the soft-404 body cannot inherit
  // indexable parent metadata or a platform canonical.
  if (
    !data.isCollection &&
    !data.category?.id &&
    data.products.length === 0 &&
    !data.productsQueryFailed &&
    !data.categoryQueryFailed
  ) {
    return buildCategoryNotFoundMetadata();
  }

  const categoryName = resolveCategoryPageName(data, category);
  const normalizedProducts = normalizeCategoryPageProducts(
    data.products as unknown as RawDbProduct[],
    undefined,
    merchant.country
  );
  const totalPages = Math.max(
    1,
    Math.ceil(normalizedProducts.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );

  if (currentPage > totalPages) {
    return buildCategoryNotFoundMetadata(
      'Category page not found',
      'This category page is unavailable or has moved.'
    );
  }

  const productOffset = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;
  const paginatedProducts = normalizedProducts.slice(
    productOffset,
    productOffset + STOREFRONT_PRODUCTS_PER_PAGE
  );

  const baseUrl = buildStoreUrl(merchant);
  const canonicalFilterParams =
    getCanonicalStorefrontFilterSearchParams(resolvedSearchParams);
  const canonicalFilterQuery = canonicalFilterParams.toString();
  const categoryUrl = `${baseUrl}/${category}${canonicalFilterQuery ? `?${canonicalFilterQuery}` : ''}`;
  const hubContent = buildCategoryPageHubModel({
    data,
    categorySlug: category,
    categoryName,
    merchantBusinessName: merchant.business_name,
    storeUrl: baseUrl,
    products: normalizedProducts,
  });
  const paginatedCategoryUrl = buildStorefrontPageHref(
    categoryUrl,
    currentPage
  );

  const titleFragment = hubContent.intro.heading;
  const pageTitleFragment =
    currentPage > 1 ? `Page ${currentPage} | ${titleFragment}` : titleFragment;
  const title = generateMetaTitle(pageTitleFragment, {
    maxLength: 70,
    suffix: merchant.business_name,
    fallback: categoryName,
  });
  const fallbackDescription = `Explore ${categoryName} at ${merchant.business_name}. Compare trusted options, pricing, and key specs with nationwide delivery and flexible payment plans.`;
  const baseDescription =
    hubContent.intro.description.trim() || fallbackDescription;
  const pageAwareDescription =
    currentPage > 1
      ? `Page ${currentPage} of ${totalPages}: ${baseDescription}`
      : baseDescription;
  const pageAwareFallback =
    currentPage > 1
      ? `Page ${currentPage} of ${totalPages}: ${fallbackDescription}`
      : fallbackDescription;
  const description = generateMetaDescription(pageAwareDescription, 160, {
    minLength: 110,
    fallback: pageAwareFallback,
  });
  const firstProductImage = paginatedProducts[0]?.image || null;
  const socialImageCandidates = [firstProductImage, merchant.logo_url];

  return {
    title,
    description,
    alternates: {
      canonical: paginatedCategoryUrl,
    },
    robots: getIndexableRobotsMetadata(resolvedSearchParams),
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

async function CategoryListingRuntime(props: PageProps) {
  // Keep tenant/domain listing work request-bound while the page prerenders a
  // Suspense fallback shell. Cache Components rejects route-level dynamic flags.
  await connection();

  return <CategoryPageContent {...props} />;
}

export default function CategoryPageRoute(props: PageProps) {
  return (
    <Suspense fallback={<CatalogListingLoading />}>
      <CategoryListingRuntime {...props} />
    </Suspense>
  );
}
