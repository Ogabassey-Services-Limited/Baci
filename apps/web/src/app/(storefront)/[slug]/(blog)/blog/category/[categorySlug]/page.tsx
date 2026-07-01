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
import { BlogPageContent } from '../../blog-page-content';
import type { BlogSearchParamValue } from '../../blog-search-params';

interface BlogCategoryPageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams?: Promise<{
    page?: BlogSearchParamValue;
    search?: BlogSearchParamValue;
  }>;
}

// Cache Components invariant: the canonical clean-category shell and its
// metadata must NOT await request searchParams. Paginated/search category
// variants canonicalize to the clean hub URL and move to the runtime path
// (follow-up PR). Canonical category pages render page 1 from cached data so
// their article/category links land in the initial HTML for crawlers.
const EMPTY_CATEGORY_SEARCH_PARAMS: NonNullable<
  BlogCategoryPageProps['searchParams']
> = Promise.resolve({});

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
}: BlogCategoryPageProps): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    return CATEGORY_NOT_FOUND_METADATA;
  }

  return buildBlogListingMetadata({
    slug,
    searchParams: { category: hub.categoryLabel },
    canonicalUrl: hub.canonicalUrl,
    indexable: true,
  });
}

function isStaticCategoryTenant(slug: string): boolean {
  return OGABASSEY_CATEGORY_STATIC_TENANTS.some(
    (staticTenantSlug) => staticTenantSlug === slug
  );
}

export default async function BlogCategoryPage({
  params,
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
      searchParams={EMPTY_CATEGORY_SEARCH_PARAMS}
    />
  );

  // Static OgaBassey category hubs render crawlable canonical content directly;
  // other tenants keep the explicit fallback for CWV.
  if (isStaticCategoryTenant(slug)) {
    return content;
  }

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
