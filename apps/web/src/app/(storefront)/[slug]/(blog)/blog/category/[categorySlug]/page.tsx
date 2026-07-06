import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { asRoute } from '@/lib/routes';
import {
  getStorefrontPathPrefix,
  resolveStorefrontPathHref,
} from '@/lib/storefront-path-prefix';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { isDomainIdentifier } from '@/lib/validation';
import { BlogListingFallback } from '../../BlogListingFallback';
import { resolveBlogCategoryHub } from '../../blog-category-hub';
import {
  canUseCleanBlogCategorySlug,
  getBlogCategorySlug,
  getCanonicalBlogCategorySlug,
  getCollidingBlogCategorySlugs,
  getOgabasseyBlogCategoryAliasSlug,
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

function buildCanonicalCategoryRoute(input: {
  categorySlug: string;
  headersList: Parameters<typeof getStorefrontPathPrefix>[0];
  searchParams?: {
    page?: BlogSearchParamValue;
    search?: BlogSearchParamValue;
  };
  slug: string;
}) {
  const pathPrefix = isDomainIdentifier(input.slug)
    ? ''
    : getStorefrontPathPrefix(input.headersList, input.slug);
  const routeSearchParams = new URLSearchParams();
  const page = toSingleBlogSearchParam(input.searchParams?.page);
  const search = toSingleBlogSearchParam(input.searchParams?.search);

  if (page) {
    routeSearchParams.set('page', page);
  }

  if (search) {
    routeSearchParams.set('search', search);
  }

  const searchSuffix = routeSearchParams.toString()
    ? `?${routeSearchParams.toString()}`
    : '';

  return asRoute(
    resolveStorefrontPathHref(
      pathPrefix,
      `/blog/category/${input.categorySlug}${searchSuffix}`
    )
  );
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
  // Over-long / repeatedly-encoded bot slugs can never match a category; bail
  // before the `'use cache'` resolveBlogCategoryHub lookup runs with an
  // unbounded key.
  if (!evaluateStorefrontSlugSafety(categorySlug).safe) {
    return CATEGORY_NOT_FOUND_METADATA;
  }
  const canonicalCategorySlug = getCanonicalBlogCategorySlug(categorySlug);
  const hub = await resolveBlogCategoryHub(slug, canonicalCategorySlug);
  const isCanonicalCategoryPath = categorySlug === canonicalCategorySlug;
  const aliasCategorySlug =
    !hub && isOgabasseyBlogStaticTenant(slug)
      ? getOgabasseyBlogCategoryAliasSlug(categorySlug)
      : null;
  const aliasHub = aliasCategorySlug
    ? await resolveBlogCategoryHub(slug, aliasCategorySlug)
    : null;
  const resolvedHub = hub ?? aliasHub;

  if (!resolvedHub) {
    return CATEGORY_NOT_FOUND_METADATA;
  }

  if (hub && !isCanonicalCategoryPath) {
    return buildBlogListingMetadata({
      slug,
      searchParams: { category: hub.categoryLabel },
      canonicalUrl: hub.canonicalUrl,
      indexable: false,
    });
  }

  if (aliasHub) {
    return buildBlogListingMetadata({
      slug,
      searchParams: { category: aliasHub.categoryLabel },
      canonicalUrl: aliasHub.canonicalUrl,
      indexable: false,
    });
  }

  // Static tenant metadata stays request-searchParams-free (prerenderable);
  // non-static category pages read ?page/?search for noindex/self-scoped
  // variants that buildBlogListingMetadata already produces.
  if (isOgabasseyBlogStaticTenant(slug)) {
    return buildBlogListingMetadata({
      slug,
      searchParams: { category: resolvedHub.categoryLabel },
      canonicalUrl: resolvedHub.canonicalUrl,
      indexable: true,
    });
  }

  const resolvedSearchParams = await searchParams;
  const page = toSingleBlogSearchParam(resolvedSearchParams?.page);
  const search = toSingleBlogSearchParam(resolvedSearchParams?.search);
  const currentPage = parseBlogListingPage(page);

  return buildBlogListingMetadata({
    slug,
    searchParams: { category: resolvedHub.categoryLabel, page, search },
    canonicalUrl:
      !search && currentPage === 1 ? resolvedHub.canonicalUrl : undefined,
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
  // Over-long / repeatedly-encoded bot slugs can never match a category; bail
  // before the `'use cache'` resolveBlogCategoryHub lookup runs with an
  // unbounded key.
  if (!evaluateStorefrontSlugSafety(categorySlug).safe) {
    notFound();
  }
  const canonicalCategorySlug = getCanonicalBlogCategorySlug(categorySlug);

  const hub = await resolveBlogCategoryHub(slug, canonicalCategorySlug);
  if (hub && categorySlug !== canonicalCategorySlug) {
    permanentRedirect(
      buildCanonicalCategoryRoute({
        categorySlug: canonicalCategorySlug,
        headersList: await headers(),
        searchParams: await (searchParams ?? Promise.resolve({})),
        slug,
      })
    );
  }

  const aliasCategorySlug =
    !hub && isOgabasseyBlogStaticTenant(slug)
      ? getOgabasseyBlogCategoryAliasSlug(categorySlug)
      : null;
  const aliasHub = aliasCategorySlug
    ? await resolveBlogCategoryHub(slug, aliasCategorySlug)
    : null;

  if (aliasHub && aliasCategorySlug) {
    permanentRedirect(
      buildCanonicalCategoryRoute({
        categorySlug: aliasCategorySlug,
        headersList: await headers(),
        searchParams: await (searchParams ?? Promise.resolve({})),
        slug,
      })
    );
  }

  const resolvedHub = hub ?? aliasHub;
  if (!resolvedHub) {
    notFound();
  }

  const content = (
    <BlogPageContent
      categoryOverride={resolvedHub.categoryLabel}
      isCleanCategoryRoute
      itemListSchemaUrl={resolvedHub.canonicalUrl}
      params={Promise.resolve({ slug })}
      searchParams={searchParams ?? Promise.resolve({})}
    />
  );

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
