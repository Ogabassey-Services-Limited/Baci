import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { asRoute } from '@/lib/routes';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogListingFallback } from '../../BlogListingFallback';
import { resolveBlogCategoryHub } from '../../blog-category-hub';
import {
  canUseCleanBlogCategorySlug,
  getBlogCategorySlug,
  getCollidingBlogCategorySlugs,
} from '../../blog-category-routing';
import { buildBlogListingMetadata } from '../../blog-listing-metadata';
import { parseBlogListingPage } from '../../blog-listing-page-params';
import { buildBlogListingRouteHref } from '../../blog-listing-route';
import { BlogPageContent } from '../../blog-page-content';
import {
  type BlogSearchParamValue,
  toSingleBlogSearchParam,
} from '../../blog-search-params';

interface BlogCategoryPageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams?: Promise<{
    page?: BlogSearchParamValue;
    search?: BlogSearchParamValue;
  }>;
}

const CATEGORY_NOT_FOUND_METADATA: Metadata = {
  title: 'Blog Category Not Found',
  robots: { index: false, follow: false },
};

const OGABASSEY_CATEGORY_STATIC_TENANTS = [
  OGABASSEY_DOMAIN,
  'ogabassey',
] as const;
const OGABASSEY_CATEGORY_STATIC_FALLBACK_SLUGS = [
  'laptops',
  'smartphones',
] as const;

async function resolveCategoryBlogSearchParams(
  searchParams: BlogCategoryPageProps['searchParams'],
  categoryLabel: string
): Promise<{
  category: string;
  page?: string;
  search?: string;
}> {
  const resolvedSearchParams = await searchParams;

  return {
    category: categoryLabel,
    page: toSingleBlogSearchParam(resolvedSearchParams?.page),
    search: toSingleBlogSearchParam(resolvedSearchParams?.search),
  };
}

async function resolveCategoryRouteBeforeShell({
  categoryLabel,
  searchParams,
  slug,
}: {
  categoryLabel: string;
  searchParams: BlogCategoryPageProps['searchParams'];
  slug: string;
}): Promise<{
  category: string;
  page?: string;
  search?: string;
}> {
  const resolvedSearchParams = await resolveCategoryBlogSearchParams(
    searchParams,
    categoryLabel
  );
  const currentPage = parseBlogListingPage(resolvedSearchParams.page);
  const data = await getCachedBlogListing(slug, {
    category: categoryLabel,
    page: currentPage,
    searchQuery: resolvedSearchParams.search,
  });

  if (!data) {
    notFound();
  }

  const totalPages = Math.max(
    1,
    Math.ceil(data.totalPosts / BLOG_LISTING_PAGE_SIZE)
  );

  if (currentPage > totalPages) {
    redirect(
      asRoute(
        buildBlogListingRouteHref({
          storeBasePath: buildStoreUrl(data.merchant),
          category: categoryLabel,
          page: totalPages,
          search: resolvedSearchParams.search,
        })
      )
    );
  }

  return resolvedSearchParams;
}

function getStaticCategorySlugs(categories: string[]): string[] {
  const publicCategories = filterPublicBlogCategories(categories);
  const collidingSlugs = getCollidingBlogCategorySlugs(publicCategories);
  const slugs = publicCategories
    .map((category) => getBlogCategorySlug(category))
    .filter(
      (categorySlug) =>
        canUseCleanBlogCategorySlug(categorySlug) &&
        !collidingSlugs.has(categorySlug)
    );

  return [...new Set(slugs)].sort();
}

export async function generateStaticParams(): Promise<
  Array<{ slug: string; categorySlug: string }>
> {
  let categorySlugs: string[] = [];

  try {
    const listing = await getCachedBlogListing(OGABASSEY_DOMAIN, { page: 1 });
    categorySlugs = getStaticCategorySlugs(listing?.categories ?? []);
  } catch {
    categorySlugs = [];
  }

  const staticCategorySlugs =
    categorySlugs.length > 0
      ? categorySlugs
      : [...OGABASSEY_CATEGORY_STATIC_FALLBACK_SLUGS];

  return OGABASSEY_CATEGORY_STATIC_TENANTS.flatMap((slug) =>
    staticCategorySlugs.map((categorySlug) => ({ slug, categorySlug }))
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogCategoryPageProps): Promise<Metadata> {
  const [{ slug, categorySlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    return CATEGORY_NOT_FOUND_METADATA;
  }

  const page = toSingleBlogSearchParam(resolvedSearchParams?.page);
  const search = toSingleBlogSearchParam(resolvedSearchParams?.search);
  const currentPage = parseBlogListingPage(page);

  return buildBlogListingMetadata({
    slug,
    searchParams: {
      category: hub.categoryLabel,
      page,
      search,
    },
    canonicalUrl: !search && currentPage === 1 ? hub.canonicalUrl : undefined,
    indexable: currentPage === 1,
  });
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: BlogCategoryPageProps) {
  // Resolve the route params and category hub before returning the async child.
  // Keep searchParams as a promise so normal category hubs can still produce a
  // Cache Components static shell without top-level request-query access.
  const { slug, categorySlug } = await params;
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    notFound();
  }
  const resolvedSearchParams = await resolveCategoryRouteBeforeShell({
    categoryLabel: hub.categoryLabel,
    searchParams,
    slug,
  });

  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent
        isCleanCategoryRoute
        itemListSchemaUrl={hub.canonicalUrl}
        params={Promise.resolve({ slug })}
        searchParams={Promise.resolve(resolvedSearchParams)}
      />
    </Suspense>
  );
}
