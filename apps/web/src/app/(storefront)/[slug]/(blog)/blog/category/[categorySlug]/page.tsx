import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BlogListingFallback } from '../../BlogListingFallback';
import { resolveBlogCategoryHub } from '../../blog-category-hub';
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

async function BlogCategoryPageContent({
  params,
  searchParams,
}: BlogCategoryPageProps) {
  const [{ slug, categorySlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    notFound();
  }

  const page = toSingleBlogSearchParam(resolvedSearchParams?.page);
  const search = toSingleBlogSearchParam(resolvedSearchParams?.search);
  const currentPage = parseBlogListingPage(page);

  return (
    <BlogPageContent
      isCleanCategoryRoute
      itemListSchemaUrl={
        !search && currentPage === 1 ? hub.canonicalUrl : undefined
      }
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({
        category: hub.categoryLabel,
        page,
        search,
      })}
    />
  );
}

export default function BlogCategoryPage(props: BlogCategoryPageProps) {
  // Keep request-time params/searchParams and category resolution below an
  // explicit Suspense boundary so Cache Components can prerender a stable PPR
  // shell instead of bailing out on cache misses.
  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogCategoryPageContent {...props} />
    </Suspense>
  );
}
