import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getCachedBlogPost } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { BlogPostPageFallback } from './BlogPostPageFallback';
import {
  buildCanonicalBlogPostUrl,
  getBlogPostTextPreview,
} from './blog-post-content';
import BlogPostPageContent from './blog-post-page-content';

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

const SOCIAL_IMAGE_METADATA = {
  width: 1200,
  height: 630,
  type: 'image/png',
} as const;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  let data: Awaited<ReturnType<typeof getCachedBlogPost>>;
  try {
    // Public metadata must remain cacheable; draft previews are rendered by
    // the request-time content subtree and deliberately receive noindex data.
    data = await getCachedBlogPost(slug, postSlug, false);
  } catch (error) {
    console.error('Error fetching cached public blog metadata', {
      slug,
      postSlug,
      error,
    });
    data = null;
  }

  if (!data) {
    return {
      title: 'Blog Post',
      robots: { index: false, follow: false },
    };
  }

  const { merchant, post } = data;
  const title = post.seo_title || post.title || 'Blog Post';
  const description =
    post.seo_description ||
    post.excerpt ||
    getBlogPostTextPreview(post.content);

  const url = buildCanonicalBlogPostUrl(merchant, post.slug);
  const baseUrl = buildStoreUrl(merchant);
  const storefrontBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const socialImageUrl = new URL(
    `blog/${post.slug}/opengraph-image`,
    storefrontBaseUrl
  ).toString();
  const socialImageAlt = post.title
    ? `${post.title} — ${merchant.business_name}`
    : title;

  return {
    title: `${title} | ${merchant.business_name}`,
    description,
    keywords: post.keywords?.join(', '),
    authors: [{ name: post.author_name }],
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      tags: post.tags,
      images: [
        {
          url: socialImageUrl,
          alt: socialImageAlt,
          ...SOCIAL_IMAGE_METADATA,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImageUrl],
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  await connection();

  return (
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={params} />
    </Suspense>
  );
}
