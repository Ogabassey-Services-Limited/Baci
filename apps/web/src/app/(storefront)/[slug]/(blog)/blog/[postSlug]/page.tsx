import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { buildStoreUrl } from '@/lib/store-url';
import {
  buildCanonicalBlogPostUrl,
  getBlogPostTextPreview,
} from './blog-post-content';
import BlogPostPageContent from './blog-post-page-content';
import { getResolvedBlogPost } from './get-resolved-blog-post';

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
  const isDraftMode = (await draftMode()).isEnabled;
  const data = await getResolvedBlogPost(slug, postSlug, isDraftMode);

  if (!data) {
    notFound();
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

export default function BlogPostPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataMarker />
      </Suspense>
      <BlogPostPageContent params={params} />
    </>
  );
}
