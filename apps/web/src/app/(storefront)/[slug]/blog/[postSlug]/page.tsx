import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { getCachedBlogPost } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBlogPostSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';
import { BlogPostBody } from './BlogPostBody';
import { BlogPostBodyFallback } from './BlogPostBodyFallback';
import { BlogPostHeader } from './BlogPostHeader';
import { buildBlogUrl, getBlogPostTextPreview } from './blog-post-content';
import { ViewCounter } from './view-counter';

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const isDraftMode = (await draftMode()).isEnabled;
  const data = await getCachedBlogPost(slug, postSlug, isDraftMode);

  if (!data) {
    return { title: 'Post Not Found' };
  }

  const { merchant, post } = data;
  const title = post.seo_title || post.title || 'Blog Post';
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const description =
    post.seo_description ||
    post.excerpt ||
    getBlogPostTextPreview(post.content);

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const url = buildBlogUrl(baseUrl, basePath, post.slug);

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
      images: post.featured_image_url
        ? [
            {
              url: post.featured_image_url,
              alt: post.featured_image_alt || post.title,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.featured_image_url ? [post.featured_image_url] : [],
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
  const { slug, postSlug } = await params;
  const isDraftMode = (await draftMode()).isEnabled;
  const data = await getCachedBlogPost(slug, postSlug, isDraftMode);

  if (!data) {
    notFound();
  }

  const { merchant, post, relatedPosts } = data;

  const content = post.content || '';

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const locale = headersList.get('accept-language')?.split(',')[0] ?? undefined;

  // Determine base path for internal links
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const postUrl = buildBlogUrl(baseUrl, basePath, post.slug);

  // Generate schema
  const blogSchema = generateBlogPostSchema({
    title: post.seo_title || post.title,
    description:
      post.seo_description ||
      post.excerpt ||
      getBlogPostTextPreview(post.content),
    url: postUrl,
    image: post.featured_image_url || `${baseUrl}/opengraph-image`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      name: post.author_name,
      url: baseUrl,
      jobTitle: post.author_title,
      description: post.author_bio,
    },
    publisher: {
      name: merchant.business_name,
      logo: merchant.logo_url || `${baseUrl}/logo.png`,
      url: baseUrl,
    },
    wordCount: post.word_count,
    keywords: post.keywords,
    category: post.category,
    readingTime: post.reading_time_minutes,
  });

  // BreadcrumbList schema
  const breadcrumbSchema = generateBreadcrumbSchema([
    {
      name: merchant.business_name,
      url: baseUrl,
    },
    {
      name: 'Blog',
      url: buildBlogUrl(baseUrl, basePath),
    },
    {
      name: post.title,
      url: postUrl,
    },
  ]);

  return (
    <>
      {isDraftMode && (
        <div className="bg-amber-600 text-white py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Preview Mode: Showing unpublished draft
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-amber-700 h-7 text-xs ml-4 border border-white/20"
            asChild
          >
            <Link href="/api/blog/exit-preview">Exit Preview</Link>
          </Button>
        </div>
      )}
      <script
        type="application/ld+json"
        /*
          biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
          nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        */
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        /*
          biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
          nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        */
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />

      <ViewCounter postId={post.id} />

      <div className="min-h-screen bg-background">
        {/* Breadcrumb Navigation */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <Link
              href={asRoute(`${basePath}/blog`)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          <article className="max-w-6xl mx-auto bg-white rounded-3xl p-6 md:p-10 md:px-12 shadow-sm border border-gray-100 overflow-hidden">
            {/* Featured Image */}
            <div className="aspect-video rounded-2xl overflow-hidden mb-8 relative bg-gray-100">
              <Image
                src={post.featured_image_url || '/placeholder.png'}
                alt={post.featured_image_alt || post.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                quality={75}
              />
            </div>

            <BlogPostHeader
              author_bio={post.author_bio}
              author_name={post.author_name}
              author_title={post.author_title}
              category={post.category}
              locale={locale}
              published_at={post.published_at}
              reading_time_minutes={post.reading_time_minutes}
              title={post.title}
            />

            <Suspense fallback={<BlogPostBodyFallback />}>
              <BlogPostBody
                basePath={basePath}
                baseUrl={baseUrl}
                content={content}
                locale={locale}
                post={{
                  author_bio: post.author_bio,
                  id: post.id,
                  slug: post.slug,
                  tags: post.tags,
                  title: post.title,
                }}
                relatedPosts={relatedPosts}
              />
            </Suspense>
          </article>
        </main>

        {/* Back to top */}
        <footer className="border-t py-8">
          <div className="container mx-auto px-4 text-center">
            <Link href={asRoute(`${basePath}/blog`)}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to all articles
              </Button>
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
