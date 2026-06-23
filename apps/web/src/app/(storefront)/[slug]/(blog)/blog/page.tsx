import type { Metadata } from 'next';
import { getCachedBlogListing } from '@/lib/cached-data';
import { generateMetaDescription, generateMetaTitle } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { parseBlogListingPage } from './blog-listing-page-params';
import { buildBlogListingSchemaUrl } from './blog-listing-schema-url';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

const LOWERCASE_TITLE_WORDS = new Set(['and', 'for', 'of', 'the', 'to']);

function normalizeBlogMetadataText(value: string | undefined): string {
  return value?.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ') ?? '';
}

function formatBlogFilterLabel(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && LOWERCASE_TITLE_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    )
    .join(' ');
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const [{ slug }, { category, page, search }] = await Promise.all([
    params,
    searchParams,
  ]);
  const currentPage = parseBlogListingPage(page);
  const filterCategory = category?.trim();
  const filterSearch = search?.trim();
  const normalizedCategory = normalizeBlogMetadataText(filterCategory);
  const normalizedSearch = normalizeBlogMetadataText(filterSearch);
  const listingOptions: {
    category?: string;
    page: number;
    searchQuery?: string;
  } = { page: currentPage };

  if (filterCategory) {
    listingOptions.category = filterCategory;
  }

  if (filterSearch) {
    listingOptions.searchQuery = filterSearch;
  }

  const data = await getCachedBlogListing(slug, listingOptions);
  if (!data) {
    return { title: 'Blog Not Found' };
  }
  const baseUrl = buildStoreUrl(data.merchant);
  const totalPages = Math.max(1, data.totalPages);
  const canonicalPage = Math.min(currentPage, totalPages);
  const canonicalUrl = buildBlogListingSchemaUrl({
    baseUrl,
    category,
    page: canonicalPage,
    search: data.searchQuery ?? search,
  });
  const socialImageCandidates = [
    data.posts[0]?.featured_image_url,
    data.merchant.logo_url,
  ];
  const categoryLabel = normalizedCategory
    ? formatBlogFilterLabel(normalizedCategory)
    : '';
  const pageSuffix = currentPage > 1 ? ` | Page ${currentPage}` : '';
  const metadataTitleBase = normalizedSearch
    ? `Search: ${normalizedSearch}${pageSuffix}`
    : normalizedCategory
      ? `${categoryLabel} Articles${pageSuffix}`
      : `Blog${pageSuffix}`;
  const metadataTitle = generateMetaTitle(metadataTitleBase, {
    suffix: data.merchant.business_name,
    maxLength: 70,
    fallback: 'Blog',
  });
  const baseDescription = normalizedSearch
    ? `Search results for "${normalizedSearch}" on ${data.merchant.business_name}'s blog.`
    : normalizedCategory
      ? `Read ${categoryLabel.toLowerCase()} articles, buying guides, product comparisons, and practical tech updates from ${data.merchant.business_name}.`
      : `Read the latest articles, news, and insights from ${data.merchant.business_name}.`;
  const pageAwareDescription =
    currentPage > 1
      ? `Page ${currentPage}: ${baseDescription}`
      : baseDescription;
  const description = generateMetaDescription(pageAwareDescription, 160, {
    minLength: 110,
    fallback: `Read expert buying guides, product comparisons, and tech updates from ${data.merchant.business_name}. Find practical recommendations tailored for shoppers in Nigeria.`,
  });
  return {
    title: metadataTitle,
    description,
    openGraph: {
      title: metadataTitle,
      description,
      type: 'website',
      url: canonicalUrl,
      siteName: data.merchant.business_name,
      images: getStorefrontOpenGraphImages(
        baseUrl,
        `${data.merchant.business_name} blog`,
        ...socialImageCandidates
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title: metadataTitle,
      description,
      images: getStorefrontTwitterImages(baseUrl, ...socialImageCandidates),
    },
    alternates: {
      canonical: canonicalUrl,
      types: {
        'application/rss+xml': `${baseUrl}/api/blog/feed/${slug}`,
      },
    },
    robots: {
      index: !normalizedCategory && !normalizedSearch && currentPage === 1,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

export default async function BlogPage(props: BlogPageProps) {
  // Keep article links in the first HTML response. The deploy smoke check and
  // crawlers parse raw /blog HTML, so a route-level Suspense shell hides posts.
  return <>{await BlogPageContent(props)}</>;
}
