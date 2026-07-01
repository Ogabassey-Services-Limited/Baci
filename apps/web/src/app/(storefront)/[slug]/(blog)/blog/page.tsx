import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { BlogListingFallback } from './BlogListingFallback';
import { buildBlogListingMetadata } from './blog-listing-metadata';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

const OGABASSEY_BLOG_STATIC_TENANTS = [OGABASSEY_DOMAIN, 'ogabassey'] as const;

// Cache Components invariant for this route:
// - The route shell and generateMetadata must NOT await request searchParams.
//   searchParams is a request-time API; awaiting it opts the canonical
//   shell/metadata into request-time rendering, which (a) prevents a static
//   shell ("did not produce a static shell") and (b) forces metadata to
//   stream, which htmlLimitedBots then withholds from DOM bots — the cause of
//   the generic `Ogabassey` title observed for Googlebot.
// - Canonical /blog content is public and cached via getCachedBlogListing(),
//   so page-1 content can land in the initial HTML for crawlers.
// - Only the static tenant forces canonical page 1 (EMPTY_BLOG_SEARCH_PARAMS)
//   so its shell stays static. Non-static tenants render dynamically behind
//   Suspense and never needed a static shell, so they keep the request
//   searchParams and their pagination/search/category behavior.
const EMPTY_BLOG_SEARCH_PARAMS: BlogPageProps['searchParams'] = Promise.resolve(
  {}
);

export function generateStaticParams(): Array<{ slug: string }> {
  return OGABASSEY_BLOG_STATIC_TENANTS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildBlogListingMetadata({
    slug,
    searchParams: {},
  });
}

function isStaticBlogTenant(slug: string): boolean {
  return OGABASSEY_BLOG_STATIC_TENANTS.some(
    (staticTenantSlug) => staticTenantSlug === slug
  );
}

export default async function BlogPage({
  params,
  searchParams,
}: BlogPageProps) {
  const { slug } = await params;
  const isStaticTenant = isStaticBlogTenant(slug);
  const content = (
    <BlogPageContent
      params={Promise.resolve({ slug })}
      searchParams={isStaticTenant ? EMPTY_BLOG_SEARCH_PARAMS : searchParams}
    />
  );

  if (isStaticTenant) {
    return content;
  }

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
