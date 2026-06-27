import type { Metadata } from 'next';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
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

export default function BlogPage(props: BlogPageProps) {
  // Keep the canonical listing content in the root blog HTML. The deploy smoke
  // check and HTML-only crawlers extract post anchors directly from this page;
  // author/category routes own the PPR shell fallback instead.
  return <BlogPageContent {...props} />;
}
