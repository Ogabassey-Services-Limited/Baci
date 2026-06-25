import type { Metadata } from 'next';
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
  // Keep article links in the first HTML response. The deploy smoke check and
  // crawlers parse raw /blog HTML, so do not add a route-level Suspense shell.
  return <BlogPageContent {...props} />;
}
