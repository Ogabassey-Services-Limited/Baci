import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { asRoute } from '@/lib/routes';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogListingFallback } from './BlogListingFallback';
import {
  buildBlogCategoryHref,
  findBlogCategoryLabelBySlug,
  getBlogCategorySlug,
} from './blog-category-routing';
import { buildBlogListingMetadata } from './blog-listing-metadata';
import { parseBlogListingPage } from './blog-listing-page-params';
import { buildBlogListingRouteHref } from './blog-listing-route';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';
import {
  type BlogSearchParamValue,
  toSingleBlogSearchParam,
} from './blog-search-params';

const OGABASSEY_BLOG_STATIC_TENANTS = [OGABASSEY_DOMAIN, 'ogabassey'] as const;
const BLOG_CATEGORY_REDIRECT_FILTER_PARAMS = new Set([
  'category',
  'page',
  'search',
]);

export function generateStaticParams(): Array<{ slug: string }> {
  return OGABASSEY_BLOG_STATIC_TENANTS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return buildBlogListingMetadata({
    slug,
    searchParams: resolvedSearchParams,
  });
}

function findPublicCategoryLabel(
  publicCategories: string[],
  category: string
): string | null {
  const trimmedCategory = category.trim();
  const normalizedCategory = trimmedCategory.toLowerCase();

  return (
    publicCategories.find(
      (publicCategory) =>
        publicCategory.trim().toLowerCase() === normalizedCategory
    ) ??
    findBlogCategoryLabelBySlug(
      publicCategories,
      getBlogCategorySlug(trimmedCategory)
    )
  );
}

function appendPreservedBlogCategoryRedirectParams(
  href: string,
  searchParamValues: Record<string, BlogSearchParamValue>
): string {
  const preservedParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParamValues)) {
    if (BLOG_CATEGORY_REDIRECT_FILTER_PARAMS.has(key)) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const paramValue of values) {
      if (paramValue === undefined) {
        continue;
      }
      preservedParams.append(key, paramValue);
    }
  }

  const queryString = preservedParams.toString();
  if (!queryString) {
    return href;
  }

  return `${href}${href.includes('?') ? '&' : '?'}${queryString}`;
}

async function resolveBlogRouteBeforeShell({
  params,
  searchParams,
}: BlogPageProps) {
  const [{ slug }, searchParamValues] = await Promise.all([
    params,
    searchParams,
  ]);
  const category = toSingleBlogSearchParam(searchParamValues.category);
  const page = toSingleBlogSearchParam(searchParamValues.page);
  const search = toSingleBlogSearchParam(searchParamValues.search);
  const currentPage = parseBlogListingPage(page);
  const data = await getCachedBlogListing(slug, {
    category,
    page: currentPage,
    searchQuery: search,
  });
  if (!data) {
    notFound();
  }

  const { merchant, categories, totalPosts, searchQuery } = data;
  const effectiveSearchQuery = searchQuery ?? search;
  const totalPages = Math.max(
    1,
    Math.ceil(totalPosts / BLOG_LISTING_PAGE_SIZE)
  );
  const publicCategories = filterPublicBlogCategories(categories);
  const basePath = buildStoreUrl(merchant);

  if (category && !search && currentPage === 1) {
    const categoryLabel = findPublicCategoryLabel(publicCategories, category);
    if (categoryLabel) {
      const categoryHref = buildBlogCategoryHref(
        basePath,
        categoryLabel,
        publicCategories
      );
      if (!categoryHref.includes('?')) {
        permanentRedirect(
          asRoute(
            appendPreservedBlogCategoryRedirectParams(
              categoryHref,
              searchParamValues
            )
          )
        );
      }
    }
  }

  if (currentPage > totalPages) {
    redirect(
      asRoute(
        buildBlogListingRouteHref({
          storeBasePath: basePath,
          category,
          page: totalPages,
          search: effectiveSearchQuery,
        })
      )
    );
  }

  return {
    data,
    searchParamValues,
    slug,
  };
}

export default async function BlogPage(props: BlogPageProps) {
  const route = await resolveBlogRouteBeforeShell(props);

  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent
        {...props}
        params={Promise.resolve({ slug: route.slug })}
        preloadedListing={route.data}
        routeDecisionsResolved
        searchParams={Promise.resolve(route.searchParamValues)}
      />
    </Suspense>
  );
}
