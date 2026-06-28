import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { BlogListingFallback } from '../../BlogListingFallback';
import { resolveBlogCategoryHub } from '../../blog-category-hub';
import {
  canUseCleanBlogCategorySlug,
  getBlogCategorySlug,
  getCollidingBlogCategorySlugs,
} from '../../blog-category-routing';
import { buildBlogListingMetadata } from '../../blog-listing-metadata';
import { parseBlogListingPage } from '../../blog-listing-page-params';
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
  // Resolve only the static category hub before the shell. Request-query/data
  // validation stays behind Suspense so Cache Components can keep a static
  // shell for category hubs.
  const { slug, categorySlug } = await params;
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    notFound();
  }

  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent
        categoryOverride={hub.categoryLabel}
        isCleanCategoryRoute
        itemListSchemaUrl={hub.canonicalUrl}
        params={Promise.resolve({ slug })}
        searchParams={searchParams ?? Promise.resolve({})}
      />
    </Suspense>
  );
}
