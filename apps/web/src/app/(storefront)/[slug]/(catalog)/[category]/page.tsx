import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import {
  generateMetaDescription,
  generateMetaTitle,
  getIndexableRobotsMetadata,
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
import { CategoryPageContent } from './category-page-content';
import {
  buildCategoryPageHubModel,
  normalizeCategoryPageProducts,
  resolveCategoryPageName,
} from './category-page-content-helpers';

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

  const categoryName = resolveCategoryPageName(data, category);
  const normalizedProducts = normalizeCategoryPageProducts(
    data.products as unknown as RawDbProduct[]
  );
  const totalPages = Math.max(
    1,
    Math.ceil(normalizedProducts.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );
  const pageStartIndex = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;
  const paginatedProducts = normalizedProducts.slice(
    pageStartIndex,
    pageStartIndex + STOREFRONT_PRODUCTS_PER_PAGE
  );

  if (currentPage > totalPages) {
    notFound();
  }

  const baseUrl = buildStoreUrl(merchant);
  const categoryUrl = `${baseUrl}/${category}`;
  const hubContent = buildCategoryPageHubModel({
    data,
    categorySlug: category,
    categoryName,
    merchantBusinessName: merchant.business_name,
    storeUrl: baseUrl,
    products: normalizedProducts,
  });
  const paginatedCategoryUrl =
    currentPage > 1 ? `${categoryUrl}?page=${currentPage}` : categoryUrl;

  const titleFragment = hubContent.intro.heading;
  const title = generateMetaTitle(
    currentPage > 1 ? `${titleFragment} - Page ${currentPage}` : titleFragment,
    {
      maxLength: 70,
      suffix: merchant.business_name,
      fallback: categoryName,
    }
  );
  const description = generateMetaDescription(
    hubContent.intro.description,
    160,
    {
      minLength: 110,
      fallback: `Explore ${categoryName} at ${merchant.business_name}. Compare trusted options, pricing, and key specs with nationwide delivery and flexible payment plans.`,
    }
  );
  const firstProductImage = paginatedProducts[0]?.image || null;
  const socialImageCandidates = [firstProductImage, merchant.logo_url];

  return {
    title,
    description,
    alternates: {
      canonical: paginatedCategoryUrl,
    },
    robots: getIndexableRobotsMetadata(),
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
  return <CategoryPageContent {...props} />;
}
