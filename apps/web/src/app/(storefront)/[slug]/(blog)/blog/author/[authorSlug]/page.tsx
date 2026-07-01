import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { resolveBlogCatchAllOutcome } from '@/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/blog-catch-all-resolution';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { getBlogAuthorBySlug, getBlogAuthorSlugs } from '@/lib/blog-authors';
import { getCachedBlogAuthor } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogListingFallback } from '../../BlogListingFallback';
import type { BlogSearchParamValue } from '../../blog-search-params';
import { BlogAuthorPageContent } from './blog-author-page-content';

interface AuthorPageProps {
  params: Promise<{ slug: string; authorSlug: string }>;
  searchParams?: Promise<{ page?: BlogSearchParamValue }>;
}

// Cache Components invariant: the canonical author shell and its metadata must
// NOT await request searchParams. Pagination (?page=N) canonicalizes to the
// clean author URL and moves to the runtime path (follow-up PR); reading it
// here would prevent a static shell and force metadata to stream (which
// htmlLimitedBots withholds from DOM bots). Canonical author pages render
// page 1 from cached data.
const EMPTY_AUTHOR_SEARCH_PARAMS: NonNullable<AuthorPageProps['searchParams']> =
  Promise.resolve({});

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
}: AuthorPageProps): Promise<Metadata> {
  const { slug, authorSlug } = await params;
  const normalizedAuthorSlug = authorSlug.toLowerCase();

  const profile = getBlogAuthorBySlug(normalizedAuthorSlug, slug);
  if (!profile) {
    return AUTHOR_NOT_FOUND_METADATA;
  }

  const data = await getCachedBlogAuthor(slug, profile.name, { page: 1 });
  if (!data) {
    return AUTHOR_NOT_FOUND_METADATA;
  }

  const { merchant, author } = data;
  const baseUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${baseUrl}/blog/author/${normalizedAuthorSlug}`;
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
    robots: {
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

async function assertNonStaticAuthorRouteBeforeShell({
  slug,
  authorSlug,
}: {
  slug: string;
  authorSlug: string;
}): Promise<void> {
  const normalizedAuthorSlug = authorSlug.toLowerCase();
  const profile = getBlogAuthorBySlug(normalizedAuthorSlug, slug);
  if (profile) {
    return;
  }

  const fallbackOutcome = await resolveBlogCatchAllOutcome({
    params: Promise.resolve({
      slug,
      catchAll: ['author', normalizedAuthorSlug],
    }),
  });

  if (fallbackOutcome.type === 'redirect') {
    if (fallbackOutcome.status === 308) {
      permanentRedirect(asRoute(fallbackOutcome.url));
    }
    redirect(asRoute(fallbackOutcome.url));
  }

  notFound();
}

export default async function BlogAuthorPage({ params }: AuthorPageProps) {
  const resolvedParams = await params;
  const content = (
    <BlogAuthorPageContent
      params={Promise.resolve(resolvedParams)}
      searchParams={EMPTY_AUTHOR_SEARCH_PARAMS}
    />
  );

  if (isStaticAuthorTenant(resolvedParams.slug)) {
    return content;
  }

  await assertNonStaticAuthorRouteBeforeShell(resolvedParams);

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
