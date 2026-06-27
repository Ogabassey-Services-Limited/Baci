import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BlogListingFallback } from './BlogListingFallback';
import { buildBlogListingMetadata } from './blog-listing-metadata';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

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

export default function BlogPage(props: BlogPageProps) {
  // Keep request-time params/searchParams and listing fetches below an explicit
  // Suspense boundary so Cache Components can prerender a stable PPR shell.
  return (
    <Suspense fallback={<BlogListingFallback />}>
      <BlogPageContent {...props} />
    </Suspense>
  );
}
