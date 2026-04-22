import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { generateMetaDescription, generateMetaTitle } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { BlogPostPageFallback } from './BlogPostPageFallback';
import {
  buildCanonicalBlogPostUrl,
  getBlogPostTextPreview,
} from './blog-post-content';
import BlogPostPageContent from './blog-post-page-content';
import { getResolvedBlogPost } from './get-resolved-blog-post';

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

function formatMerchantCountry(countryCode?: string | null) {
  if (!countryCode) {
    return null;
  }

  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

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
  const merchantCountry = formatMerchantCountry(merchant.country);
  const metadataTitle = generateMetaTitle(title, {
    maxLength: 70,
    suffix: merchant.business_name,
    fallback: 'Blog Post',
  });
  const description = generateMetaDescription(
    post.seo_description ||
      post.excerpt ||
      getBlogPostTextPreview(post.content),
    155,
    {
      minLength: 110,
      fallback: merchantCountry
        ? `${post.title} by ${merchant.business_name}. Read practical buying advice, product insights, and shopping tips for customers in ${merchantCountry}.`
        : `${post.title} by ${merchant.business_name}. Read practical buying advice, product insights, and shopping tips for shoppers everywhere.`,
    }
  );

  const url = buildCanonicalBlogPostUrl(merchant, post.slug);
  const baseUrl = buildStoreUrl(merchant);
  const socialImageCandidates = [post.featured_image_url, merchant.logo_url];

  return {
    title: metadataTitle,
    description,
    keywords: post.keywords?.join(', '),
    authors: [{ name: post.author_name }],
    openGraph: {
      title: metadataTitle,
      description,
      type: 'article',
      url,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      tags: post.tags,
      images: getStorefrontOpenGraphImages(
        baseUrl,
        post.featured_image_alt || post.title,
        ...socialImageCandidates
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title: metadataTitle,
      description,
      images: getStorefrontTwitterImages(baseUrl, ...socialImageCandidates),
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
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={params} />
    </Suspense>
  );
}
