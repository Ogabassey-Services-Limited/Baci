import type { Metadata } from 'next';
import { Suspense } from 'react';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import {
  getPlatformBlogPost,
  PLATFORM_BLOG_CONTEXT,
} from '@/lib/platform-blog';
import { generateMetaDescription, generateMetaTitle } from '@/lib/seo-utils';
import { BlogPostPageContent } from './blog-post-page-content';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getPlatformBlogPostUrl(slug: string): string {
  return `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog/${slug}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPlatformBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found - Baci Blog',
    };
  }

  const title = generateMetaTitle(post.seo_title || post.title, {
    maxLength: 70,
    suffix: 'Baci Blog',
    fallback: 'Baci Blog',
  });
  const description = generateMetaDescription(
    post.seo_description || post.excerpt || '',
    155,
    {
      minLength: 100,
      fallback: `${post.title} on Baci Blog. Read practical insights, buyer guides, and product updates for smarter shopping decisions.`,
    }
  );
  const canonicalUrl = getPlatformBlogPostUrl(post.slug);
  const ogImageUrl = `${canonicalUrl}/opengraph-image`;

  return {
    title,
    description,
    keywords: post.keywords?.join(', '),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalUrl,
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author_name ? [post.author_name] : undefined,
      images: [ogImageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
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

function BlogPostPageFallback() {
  return (
    <AppBody>
      <div className="flex min-h-screen flex-col bg-background font-sans">
        <PlatformHeader />
        <main className="flex-1 px-4 pb-16 pt-24 md:px-6">
          <div className="mx-auto max-w-4xl">
            <p className="mb-4 text-sm text-muted-foreground">
              Loading article…
            </p>
            <div className="mb-8 h-5 w-32 rounded bg-muted" />
            <div className="mb-4 h-12 w-full max-w-3xl rounded bg-muted" />
            <div className="mb-8 h-4 w-64 rounded bg-muted" />
            <div className="aspect-video w-full rounded-xl bg-muted" />
          </div>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

export default function BlogPostPage({ params }: PageProps) {
  return (
    <Suspense fallback={<BlogPostPageFallback />}>
      <BlogPostPageContent params={params} />
    </Suspense>
  );
}
