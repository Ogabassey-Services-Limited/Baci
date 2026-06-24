import type { Metadata } from 'next';
import { getCachedBlogListing } from '@/lib/cached-data';
import { generateMetaDescription } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { parseBlogListingPage } from './blog-listing-page-params';
import { buildBlogListingSchemaUrl } from './blog-listing-schema-url';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

export async function generateMetadata({
  params,
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const [{ slug }, { category, page, search }] = await Promise.all([
    params,
    searchParams,
  ]);
  const currentPage = parseBlogListingPage(page);
  const data = await getCachedBlogListing(slug, {
    category,
    page: currentPage,
    searchQuery: search,
  });
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
  const description = generateMetaDescription(
    `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    160,
    {
      minLength: 110,
      fallback: `Read expert buying guides, product comparisons, and tech updates from ${data.merchant.business_name}. Find practical recommendations tailored for shoppers in Nigeria.`,
    }
  );
  return {
    title: `Blog | ${data.merchant.business_name}`,
    description,
    openGraph: {
      title: `Blog | ${data.merchant.business_name}`,
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
      title: `Blog | ${data.merchant.business_name}`,
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
      index: true,
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
