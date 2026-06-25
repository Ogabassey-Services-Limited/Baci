import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { buildStoreUrl } from '@/lib/store-url';
import {
  buildBlogCategorySchemaUrl,
  findBlogCategoryLabelBySlug,
} from '../../blog-category-routing';
import { buildBlogListingMetadata } from '../../blog-listing-metadata';
import { parseBlogListingPage } from '../../blog-listing-page-params';
import { BlogPageContent } from '../../blog-page-content';

type BlogSearchParamValue = string | string[] | undefined;

interface BlogCategoryPageProps {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams?: Promise<{
    page?: BlogSearchParamValue;
    search?: BlogSearchParamValue;
  }>;
}

interface ResolvedBlogCategoryHub {
  canonicalUrl: string;
  categoryLabel: string;
}

const CATEGORY_NOT_FOUND_METADATA: Metadata = {
  title: 'Blog Category Not Found',
  robots: { index: false, follow: false },
};

function toSingleBlogSearchParam(
  value: BlogSearchParamValue
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveBlogCategoryHub(
  slug: string,
  categorySlug: string
): Promise<ResolvedBlogCategoryHub | null> {
  const data = await getCachedBlogListing(slug, { page: 1 });
  if (!data) {
    return null;
  }

  const publicCategories = filterPublicBlogCategories(data.categories);
  const categoryLabel = findBlogCategoryLabelBySlug(
    publicCategories,
    categorySlug
  );
  if (!categoryLabel) {
    return null;
  }

  return {
    canonicalUrl: buildBlogCategorySchemaUrl(
      buildStoreUrl(data.merchant),
      categoryLabel
    ),
    categoryLabel,
  };
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
  const [{ slug, categorySlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const hub = await resolveBlogCategoryHub(slug, categorySlug);
  if (!hub) {
    notFound();
  }

  return (
    <>
      {
        await BlogPageContent({
          params: Promise.resolve({ slug }),
          searchParams: Promise.resolve({
            category: hub.categoryLabel,
            page: toSingleBlogSearchParam(resolvedSearchParams?.page),
            search: toSingleBlogSearchParam(resolvedSearchParams?.search),
          }),
        })
      }
    </>
  );
}
