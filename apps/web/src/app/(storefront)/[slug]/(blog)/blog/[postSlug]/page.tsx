import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { getBlogPostRedirect } from '@/lib/blog-post-redirects';
import { getCachedBlogPost } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { generateMetaDescription, generateMetaTitle } from '@/lib/seo-utils';
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
  const metadataTitle = generateMetaTitle(title, {
    suffix: merchant.business_name,
    maxLength: 70,
    fallback: 'Blog Post',
  });
  const description = generateMetaDescription(
    post.seo_description ||
      post.excerpt ||
      getBlogPostTextPreview(post.content),
    160,
    {
      minLength: 110,
      fallback: `Read ${post.title || 'this article'} from ${merchant.business_name} for buying guidance, product context, and local shopping insights.`,
    }
  );

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
    title: metadataTitle,
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
  const resolvedParams = await params;
  let redirectedPost: Awaited<ReturnType<typeof getBlogPostRedirect>> = null;
  try {
    redirectedPost = await getBlogPostRedirect(
      resolvedParams.slug,
      resolvedParams.postSlug
    );
  } catch (error) {
    console.error('Blog redirect lookup failed at page boundary', {
      slug: resolvedParams.slug,
      postSlug: resolvedParams.postSlug,
      error,
    });
  }

  if (redirectedPost) {
    permanentRedirect(
      asRoute(
        buildCanonicalBlogPostUrl(
          redirectedPost.merchant,
          redirectedPost.targetSlug
        )
      )
    );
  }

  const { isEnabled: isDraftMode } = await draftMode();
  if (!isDraftMode) {
    let publicPost: Awaited<ReturnType<typeof getCachedBlogPost>>;
    try {
      publicPost = await getCachedBlogPost(
        resolvedParams.slug,
        resolvedParams.postSlug,
        false
      );
    } catch (error) {
      console.error('Error fetching cached public blog post at page boundary', {
        slug: resolvedParams.slug,
        postSlug: resolvedParams.postSlug,
        error,
      });
      throw error;
    }
    if (!publicPost) {
      notFound();
    }
  }

  return (
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={Promise.resolve(resolvedParams)} />
    </Suspense>
  );
}
