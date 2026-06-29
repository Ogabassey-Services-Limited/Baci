import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { BlogListingFallback } from './BlogListingFallback';
import { buildBlogListingMetadata } from './blog-listing-metadata';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

const OGABASSEY_BLOG_STATIC_TENANTS = [OGABASSEY_DOMAIN, 'ogabassey'] as const;

export function generateStaticParams(): Array<{ slug: string }> {
  return OGABASSEY_BLOG_STATIC_TENANTS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: BlogPageProps): Promise<Metadata> {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return buildBlogListingMetadata({
    slug,
    searchParams: resolvedSearchParams,
  });
}

export default async function BlogPage(props: BlogPageProps) {
  const { slug } = await props.params;

  // With Cache Components, the page shell must not subscribe to request-bound
  // searchParams or listing data. React still server-streams the cached listing
  // content after this static fallback, preserving crawlable links and metadata
  // without forcing a request-time shell or adding connection() workarounds.
  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent {...props} params={Promise.resolve({ slug })} />
    </Suspense>
  );
}
