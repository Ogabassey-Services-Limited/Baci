import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { getBlogAuthorBySlug, getBlogAuthorSlugs } from '@/lib/blog-authors';
import { getCachedBlogAuthor } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogListingFallback } from '../../BlogListingFallback';
import { parseBlogListingPage } from '../../blog-listing-page-params';
import {
  type BlogSearchParamValue,
  toSingleBlogSearchParam,
} from '../../blog-search-params';
import { BlogAuthorPageContent } from './blog-author-page-content';

interface AuthorPageProps {
  params: Promise<{ slug: string; authorSlug: string }>;
  searchParams?: Promise<{ page?: BlogSearchParamValue }>;
}

const AUTHOR_NOT_FOUND_METADATA: Metadata = {
  title: 'Author Not Found',
  robots: { index: false, follow: false },
};

const OGABASSEY_AUTHOR_STATIC_TENANTS = [
  OGABASSEY_DOMAIN,
  'ogabassey',
] as const;

export function generateStaticParams(): Array<{
  slug: string;
  authorSlug: string;
}> {
  return OGABASSEY_AUTHOR_STATIC_TENANTS.flatMap((slug) =>
    getBlogAuthorSlugs().map((authorSlug) => ({ slug, authorSlug }))
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: AuthorPageProps): Promise<Metadata> {
  const { slug, authorSlug } = await params;
  const page = parseBlogListingPage(
    toSingleBlogSearchParam((await searchParams)?.page)
  );
  const normalizedAuthorSlug = authorSlug.toLowerCase();

  const profile = getBlogAuthorBySlug(normalizedAuthorSlug, slug);
  if (!profile) {
    return AUTHOR_NOT_FOUND_METADATA;
  }

  const data = await getCachedBlogAuthor(slug, profile.name, { page });
  if (!data) {
    return AUTHOR_NOT_FOUND_METADATA;
  }

  const { merchant, author } = data;
  const baseUrl = buildStoreUrl(merchant);
  const authorBaseUrl = `${baseUrl}/blog/author/${normalizedAuthorSlug}`;
  const canonicalUrl =
    page > 1 ? `${authorBaseUrl}?page=${page}` : authorBaseUrl;
  const roleLine = author.title
    ? `${author.title} at ${merchant.business_name}`
    : `Writer at ${merchant.business_name}`;
  const title = `${author.name} — ${roleLine}`;
  const description =
    author.bio || `Read the latest articles by ${author.name}, ${roleLine}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: canonicalUrl,
      siteName: merchant.business_name,
      ...(author.imageUrl
        ? { images: [{ url: author.imageUrl, alt: author.name }] }
        : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(author.imageUrl ? { images: [author.imageUrl] } : {}),
    },
    alternates: { canonical: canonicalUrl },
    robots:
      page > 1
        ? { index: false, follow: true }
        : {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
  };
}

function isStaticAuthorTenant(slug: string): boolean {
  return OGABASSEY_AUTHOR_STATIC_TENANTS.some(
    (staticTenantSlug) => staticTenantSlug === slug
  );
}

export default async function BlogAuthorPage({
  params,
  searchParams,
}: AuthorPageProps) {
  const resolvedParams = await params;
  const content = (
    <BlogAuthorPageContent
      params={Promise.resolve(resolvedParams)}
      searchParams={searchParams}
    />
  );

  if (isStaticAuthorTenant(resolvedParams.slug)) {
    return content;
  }

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
