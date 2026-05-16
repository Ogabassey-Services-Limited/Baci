import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { SafeHtml } from '@/components/ui/safe-html';
import {
  getPlatformBlogPost,
  PLATFORM_BLOG_CONTEXT,
} from '@/lib/platform-blog';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBlogPostSchema,
  generateBreadcrumbSchema,
  generateMetaDescription,
  generateMetaTitle,
} from '@/lib/seo-utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPlatformBlogPost(slug);

  if (!post) {
    notFound();
  }

  const postUrl = getPlatformBlogPostUrl(post.slug);
  const blogSchema = generateBlogPostSchema({
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || post.title,
    url: postUrl,
    image: post.featured_image_url || undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: {
      name: post.author_name || PLATFORM_BLOG_CONTEXT.businessName,
      url: PLATFORM_BLOG_CONTEXT.baseUrl,
      jobTitle: post.author_title || undefined,
      description: post.author_bio || undefined,
    },
    publisher: {
      name: PLATFORM_BLOG_CONTEXT.businessName,
      logo: PLATFORM_BLOG_CONTEXT.logoUrl,
      url: PLATFORM_BLOG_CONTEXT.baseUrl,
    },
    wordCount: post.word_count ?? undefined,
    keywords: post.keywords ?? undefined,
    category: post.category ?? undefined,
    readingTime: post.reading_time_minutes ?? undefined,
  });
  const breadcrumbSchema = generateBreadcrumbSchema([
    {
      name: PLATFORM_BLOG_CONTEXT.businessName,
      url: PLATFORM_BLOG_CONTEXT.baseUrl,
    },
    {
      name: 'Blog',
      url: `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog`,
    },
    {
      name: post.title,
      url: postUrl,
    },
  ]);

  return (
    <AppBody>
      <div className="flex min-h-screen flex-col bg-background font-sans">
        <script
          type="application/ld+json"
          /*
            biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is safely escaped with safeJsonLdStringify
          */
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
        />
        <script
          type="application/ld+json"
          /*
            biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is safely escaped with safeJsonLdStringify
          */
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(breadcrumbSchema),
          }}
        />

        <PlatformHeader />
        <main className="flex-1 pb-16 pt-24">
          <article className="container mx-auto max-w-4xl px-4 md:px-6">
            <Link
              href={asRoute('/blog')}
              className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>

            <header className="mb-8">
              {post.category ? (
                <p className="mb-3 text-sm font-medium text-accent">
                  {post.category}
                </p>
              ) : null}
              <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {post.published_at ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(post.published_at)}
                  </span>
                ) : null}
                {post.reading_time_minutes ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {post.reading_time_minutes} min read
                  </span>
                ) : null}
              </div>
            </header>

            {post.featured_image_url ? (
              <div className="relative mb-8 aspect-video overflow-hidden rounded-xl">
                <Image
                  src={post.featured_image_url}
                  alt={post.featured_image_alt || post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  className="object-cover"
                  priority
                />
              </div>
            ) : null}

            <SafeHtml
              html={post.content || ''}
              className="prose prose-lg mb-10 max-w-none dark:prose-invert"
            />
          </article>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}
