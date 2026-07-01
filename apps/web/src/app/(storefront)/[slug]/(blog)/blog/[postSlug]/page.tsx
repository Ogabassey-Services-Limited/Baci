import type { Metadata } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import { draftMode } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getBlogPostRedirect } from '@/lib/blog-post-redirects';
import {
  getCachedBlogPost,
  getCachedFeatureSettings,
  getMerchantStrict,
} from '@/lib/cached-data';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import { asRoute } from '@/lib/routes';
import { generateMetaDescription, generateMetaTitle } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { createPublicClient } from '@/lib/supabase/anon';
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

async function hasPublicBlogPost(
  identifier: string,
  postSlug: string
): Promise<boolean> {
  'use cache';
  const normalizedPostSlug = postSlug.trim().toLowerCase();
  if (!normalizedPostSlug) {
    return false;
  }

  cacheLife('blog');
  cacheTag('blog-posts', getBlogCacheTag(identifier, normalizedPostSlug));

  const merchant = await getMerchantStrict(identifier.toLowerCase());
  if (!merchant) {
    return false;
  }

  let features: Awaited<ReturnType<typeof getCachedFeatureSettings>>;
  try {
    features = await getCachedFeatureSettings(merchant.id);
  } catch (error) {
    console.error('Error checking blog feature flag at page boundary', {
      slug: identifier,
      postSlug,
      error,
    });
    return true;
  }
  if (!features?.blog_enabled) {
    return false;
  }

  const supabase = createPublicClient({
    clientInfo: 'baci-web-blog-post-existence',
    timeoutMs: 5000,
  });

  let query = supabase
    .from('blog_posts')
    .select('id, title, slug')
    .eq('merchant_id', merchant.id)
    .eq('slug', normalizedPostSlug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '');

  query = applyPublicBlogSqlFilters(query);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('Error checking public blog post at page boundary', {
      slug: identifier,
      postSlug,
      error,
    });
    return true;
  }

  return Boolean(data);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  let data: Awaited<ReturnType<typeof getCachedBlogPost>>;
  let metadataLookupFailed = false;
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
    metadataLookupFailed = true;
  }

  if (!data) {
    if (!metadataLookupFailed) {
      const { isEnabled: isDraftPreview } = await draftMode();
      if (!isDraftPreview) {
        let redirectedPost: Awaited<ReturnType<typeof getBlogPostRedirect>> =
          null;
        try {
          redirectedPost = await getBlogPostRedirect(slug, postSlug);
        } catch (error) {
          console.error('Blog redirect lookup failed in metadata', {
            slug,
            postSlug,
            error,
          });
          return {
            title: 'Blog Post',
            robots: { index: false, follow: false },
          };
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

        notFound();
      }
    }

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
  let redirectLookupError: unknown = null;
  try {
    redirectedPost = await getBlogPostRedirect(
      resolvedParams.slug,
      resolvedParams.postSlug
    );
  } catch (error) {
    redirectLookupError = error;
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
    let hasPublicPost = false;
    try {
      hasPublicPost = await hasPublicBlogPost(
        resolvedParams.slug,
        resolvedParams.postSlug
      );
    } catch (error) {
      console.error('Error checking public blog post at page boundary', {
        slug: resolvedParams.slug,
        postSlug: resolvedParams.postSlug,
        error,
      });
      throw error;
    }
    if (!hasPublicPost) {
      if (redirectLookupError) {
        try {
          redirectedPost = await getBlogPostRedirect(
            resolvedParams.slug,
            resolvedParams.postSlug
          );
        } catch (error) {
          console.error('Blog redirect retry failed before notFound', {
            slug: resolvedParams.slug,
            postSlug: resolvedParams.postSlug,
            error,
          });
          throw error;
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
      }

      notFound();
    }
  }

  return (
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={Promise.resolve(resolvedParams)} />
    </Suspense>
  );
}
