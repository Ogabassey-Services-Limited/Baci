import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getBlogAuthorBySlug } from '@/lib/blog-authors';
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

export default function BlogAuthorPage(props: AuthorPageProps) {
  // Keep request-time params/searchParams and author listing fetches below an
  // explicit Suspense boundary so Cache Components can prerender a stable PPR
  // shell instead of bailing out on cache misses.
  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogAuthorPageContent {...props} />
    </Suspense>
  );
}
