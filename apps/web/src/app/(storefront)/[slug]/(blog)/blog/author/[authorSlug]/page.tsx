import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { getBlogAuthorBySlug, getBlogAuthorSlugs } from '@/lib/blog-authors';
import { getCachedBlogAuthor } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogListingFallback } from '../../BlogListingFallback';
import { parseBlogListingPage } from '../../blog-listing-page-params';
import { BlogAuthorPageContent } from './blog-author-page-content';

interface AuthorPageProps {
  params: Promise<{ slug: string; authorSlug: string }>;
  searchParams?: Promise<{ page?: string }>;
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
  const page = parseBlogListingPage((await searchParams)?.page);
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

export default function BlogAuthorPage({
  params,
  searchParams,
}: AuthorPageProps) {
  // Keep the route shell invariant under Cache Components: author validation,
  // legacy redirect fallback, searchParams, and cached author data all resolve
  // inside the Suspense subtree instead of the page shell.
  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogAuthorPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
