import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CatalogListingLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import {
  getCachedCategories,
  getCachedCategoryPageData,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import CategoryPageRoute, {
  generateMetadata as generateCategoryMetadata,
} from '../[category]/page';
import { buildCompareIndexSections } from './compare-index-discovery';
import { ComparePageContent } from './compare-page-content';

interface CompareIndexPageProps {
  params: Promise<{ slug: string }>;
}

const COMPARE_CATEGORY_SLUG = 'compare';

function hasCompareCategory(categories: { slug: string | null | undefined }[]) {
  return categories.some(
    (category) =>
      canonicalizeCategorySlug(category.slug) === COMPARE_CATEGORY_SLUG
  );
}

function buildCompareCategoryPageProps(slug: string) {
  return {
    params: Promise.resolve({
      slug,
      category: COMPARE_CATEGORY_SLUG,
    }),
    searchParams: Promise.resolve({}),
  };
}

function buildCompareNotFoundMetadata(): Metadata {
  const title = 'Compare products page not found';
  const description = 'This compare products page is unavailable or has moved.';

  return {
    title,
    description,
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
}: CompareIndexPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return buildCompareNotFoundMetadata();
  }

  const storeUrl = buildStoreUrl(merchant);
  const categories = await getCachedCategories(merchant.id);

  if (hasCompareCategory(categories)) {
    return generateCategoryMetadata(buildCompareCategoryPageProps(slug));
  }

  const sections = await buildCompareIndexSections({
    categories,
    getCategoryPageData: (categorySlug, productOffset, productLimit) =>
      getCachedCategoryPageData(
        merchant.id,
        categorySlug,
        merchant.slug,
        productOffset,
        productLimit
      ),
    linksPerCategoryLimit: 1,
    storeUrl,
    totalLinkLimit: 1,
  });
  const hasCompareSections = sections.length > 0;
  const title = `Compare products | ${merchant.business_name}`;
  const description = generateMetaDescription(
    `Compare ${merchant.business_name} products by category, specs, pricing, condition, warranty, and buying fit.`,
    160,
    {
      minLength: 110,
      fallback: `Compare products from ${merchant.business_name} by specs, price, category, and buying priorities before checkout.`,
    }
  );

  return {
    title,
    description,
    alternates: {
      canonical: `${storeUrl}/compare`,
    },
    robots: hasCompareSections
      ? getIndexableRobotsMetadata()
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${storeUrl}/compare`,
      type: 'website',
      siteName: merchant.business_name,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

async function CompareIndexRuntime(props: CompareIndexPageProps) {
  await connection();
  const { slug } = await props.params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (merchant) {
    const categories = await getCachedCategories(merchant.id);

    if (hasCompareCategory(categories)) {
      return <CategoryPageRoute {...buildCompareCategoryPageProps(slug)} />;
    }
  }

  return <ComparePageContent {...props} />;
}

export default function CompareIndexPage(props: CompareIndexPageProps) {
  return (
    <Suspense fallback={<CatalogListingLoading />}>
      <CompareIndexRuntime {...props} />
    </Suspense>
  );
}
