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
  const content = (
    <BlogPageContent {...props} params={Promise.resolve({ slug })} />
  );

  // Keep the canonical listing content in the root blog HTML. The deploy smoke
  // check and HTML-only crawlers extract post anchors directly from this page;
  // author/category routes own the PPR shell fallback instead.
  if (OGABASSEY_BLOG_STATIC_TENANTS.some((staticSlug) => staticSlug === slug)) {
    return content;
  }

  return <Suspense fallback={<BlogListingFallback />}>{content}</Suspense>;
}
