import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { BlogListingFallback } from '../../BlogListingFallback';
import { resolveBlogCategoryHub } from '../../blog-category-hub';
import {
  canUseCleanBlogCategorySlug,
  getBlogCategorySlug,
  getCollidingBlogCategorySlugs,
  isOgabasseyBlogStaticTenant,
  OGABASSEY_BLOG_PRIMARY_STATIC_TENANT,
  OGABASSEY_BLOG_STATIC_TENANTS,
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

// Cache Components invariant: generateMetadata stays request-searchParams-free
// for the STATIC tenant so its metadata prerenders (streamed metadata is
// withheld from DOM bots by htmlLimitedBots). Non-static category pages read
// ?page/?search for noindex/self-scoped variants. The listing content reads
// searchParams and renders behind Suspense for all tenants, so paginated/search
// category variants keep working; the Suspense fallback is the static shell.

const CATEGORY_NOT_FOUND_METADATA: Metadata = {
  title: 'Blog Category Not Found',
  robots: { index: false, follow: false },
};

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
    const listing = await getCachedBlogListing(
      OGABASSEY_BLOG_PRIMARY_STATIC_TENANT,
      {
        page: 1,
      }
    );
    categorySlugs = getStaticCategorySlugs(listing?.categories ?? []);
  } catch {
    categorySlugs = [];
  }

  const staticCategorySlugs =
    categorySlugs.length > 0
      ? categorySlugs
      : [...OGABASSEY_CATEGORY_STATIC_FALLBACK_SLUGS];

  return OGABASSEY_BLOG_STATIC_TENANTS.flatMap((slug) =>
    staticCategorySlugs.map((categorySlug) => ({ slug, categorySlug }))
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogCategoryPageProps): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    return CATEGORY_NOT_FOUND_METADATA;
  }

  // Static tenant metadata stays request-searchParams-free (prerenderable);
  // non-static category pages read ?page/?search for noindex/self-scoped
  // variants that buildBlogListingMetadata already produces.
  if (isOgabasseyBlogStaticTenant(slug)) {
    return buildBlogListingMetadata({
      slug,
      searchParams: { category: hub.categoryLabel },
      canonicalUrl: hub.canonicalUrl,
      indexable: true,
    });
  }

  const resolvedSearchParams = await searchParams;
  const page = toSingleBlogSearchParam(resolvedSearchParams?.page);
  const search = toSingleBlogSearchParam(resolvedSearchParams?.search);
  const currentPage = parseBlogListingPage(page);

  return buildBlogListingMetadata({
    slug,
    searchParams: { category: hub.categoryLabel, page, search },
    canonicalUrl: !search && currentPage === 1 ? hub.canonicalUrl : undefined,
    indexable: currentPage === 1,
  });
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: BlogCategoryPageProps) {
  // Deterministic, cache-safe hub validation before any streaming so unknown
  // clean categories return a real 404 (not a streamed 200).
  const { slug, categorySlug } = await params;
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    notFound();
  }

  const content = (
    <BlogPageContent
      categoryOverride={hub.categoryLabel}
      isCleanCategoryRoute
      itemListSchemaUrl={hub.canonicalUrl}
      params={Promise.resolve({ slug })}
      searchParams={searchParams ?? Promise.resolve({})}
    />
  );

  if (isOgabasseyBlogStaticTenant(slug)) {
    return content;
  }

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
