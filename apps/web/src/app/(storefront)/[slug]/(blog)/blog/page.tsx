import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { BlogListingFallback } from './BlogListingFallback';
import { buildBlogListingMetadata } from './blog-listing-metadata';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

const OGABASSEY_BLOG_STATIC_TENANTS = [OGABASSEY_DOMAIN, 'ogabassey'] as const;

// Cache Components invariant for this route:
// - generateMetadata must be request-searchParams-free for the STATIC tenant so
//   its metadata prerenders. Awaiting searchParams there forces metadata to
//   stream, which htmlLimitedBots then withholds from DOM bots — the cause of
//   the generic `Ogabassey` title seen for Googlebot. Non-static tenants render
//   dynamically, so their metadata may read searchParams to keep query-specific
//   noindex/self-canonical variants (search/pagination/category).
// - The listing content reads searchParams, so it renders behind Suspense for
//   all tenants. The Suspense fallback is the prerenderable static shell (fixing
//   "did not produce a static shell"), while page/search/category content
//   streams — so pagination/search keep working, including on the static tenant.

function isStaticBlogTenant(slug: string): boolean {
  return OGABASSEY_BLOG_STATIC_TENANTS.some(
    (staticTenantSlug) => staticTenantSlug === slug
  );
}

export function generateStaticParams(): Array<{ slug: string }> {
  return OGABASSEY_BLOG_STATIC_TENANTS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (isStaticBlogTenant(slug)) {
    return buildBlogListingMetadata({ slug, searchParams: {} });
  }

  return buildBlogListingMetadata({ slug, searchParams: await searchParams });
}

export default async function BlogPage({
  params,
  searchParams,
}: BlogPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent
        params={Promise.resolve({ slug })}
        searchParams={searchParams}
      />
    </Suspense>
  );
}
