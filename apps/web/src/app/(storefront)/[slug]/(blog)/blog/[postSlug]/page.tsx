import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedBlogPost } from '@/lib/cached-data';
import { generateMetaDescription } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildStorefrontMetadataTitle } from '@/lib/storefront-metadata-title';
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

// Missing, retired, and draft-only posts share one cacheable noindex stub.
// The real HTTP 404/308 for those slugs is owned by the proxy blog-post
// preflight, which decides status BEFORE this route streams — metadata must
// stay free of request APIs (connection()/draftMode()) or the whole route
// loses its static shell (NEXT_STATIC_GEN_BAILOUT on every request).
const BLOG_POST_NOINDEX_METADATA: Metadata = {
  title: 'Blog Post',
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;

  // Cached-only lookup keeps generateMetadata prerenderable. Metadata resolves
  // outside every Suspense boundary, and with htmlLimitedBots configured a
  // dynamic API here forces the whole document to request time — the exact
  // static-shell bailout this route shipped with connection() at the top.
  let data: Awaited<ReturnType<typeof getCachedBlogPost>> = null;
  try {
    data = await getCachedBlogPost(slug, postSlug, false);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error fetching cached public blog metadata', {
      slug,
      postSlug,
      error,
    });
  }

  if (!data) {
    return BLOG_POST_NOINDEX_METADATA;
  }

  const { merchant, post } = data;
  const title = post.seo_title || post.title || 'Blog Post';
  const { metadataTitle, title: metadataTitleText } =
    buildStorefrontMetadataTitle({
      title,
      suffix: merchant.business_name,
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
      title: metadataTitleText,
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
      title: metadataTitleText,
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
  // The page root must stay free of request APIs and lookups so this Suspense
  // fallback prerenders as the route's static shell. Status/draft/redirect
  // behavior lives elsewhere by design:
  // - hard 404/308 for missing/retired slugs → proxy blog-post preflight,
  //   which sets the status before the App Router streams;
  // - draft previews, the soft not-found body, and the client-side canonical
  //   redirect fallback → BlogPostPageContent, inside the boundary below.
  // Re-adding connection()/draftMode()/lookups here reverts the route to a
  // per-request NEXT_STATIC_GEN_BAILOUT (see PR #2882).
  return (
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={params} />
    </Suspense>
  );
}
