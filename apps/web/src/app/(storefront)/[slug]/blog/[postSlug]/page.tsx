import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  User,
} from 'lucide-react';
import { marked } from 'marked';
import type { Metadata, Route } from 'next';
import { draftMode, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogContentRenderer } from '@/components/blog/renderer/BlogContentRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCachedBlogPost } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  generateBlogPostSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';
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
  const description =
    post.seo_description ||
    post.excerpt ||
    (typeof post.content === 'string'
      ? post.content.substring(0, 160)
      : 'Read the latest from our blog.');

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const url = `${baseUrl}/blog/${post.slug}`;

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

  // Intelligently parse content based on format
  const content = post.content || '';
  const contentStr =
    typeof content === 'string' ? content : JSON.stringify(content);

  // Check if it's potentially raw JSON (TipTap/Novel output)
  const isJson =
    contentStr.trim().startsWith('{') || contentStr.trim().startsWith('[');
  const isHtml = contentStr.trim().startsWith('<');

  let legacyHtml = '';
  if (!isJson) {
    if (isHtml) {
      legacyHtml = sanitizeHtml(contentStr);
    } else {
      legacyHtml = sanitizeHtml(await marked(contentStr));
    }
  }

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Determine base path for internal links
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;

  // Generate schema
  const blogSchema = generateBlogPostSchema({
    title: post.seo_title || post.title,
    description:
      post.seo_description || post.excerpt || post.content.substring(0, 160),
    url: `${baseUrl}/blog/${post.slug}`,
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
      url: `${baseUrl}/blog`,
    },
    {
      name: post.title,
      url: `${baseUrl}/blog/${post.slug}`,
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
      />

      <ViewCounter postId={post.id} />

      <div
        className="min-h-screen bg-gray-50"
        style={
          {
            '--background': '0 0% 100%',
            '--foreground': '240 10% 3.9%',
            '--card': '0 0% 100%',
            '--card-foreground': '240 10% 3.9%',
            '--popover': '0 0% 100%',
            '--popover-foreground': '240 10% 3.9%',
            '--primary': '240 5.9% 10%',
            '--primary-foreground': '0 0% 98%',
            '--secondary': '240 4.8% 95.9%',
            '--secondary-foreground': '240 5.9% 10%',
            '--muted': '240 4.8% 95.9%',
            '--muted-foreground': '240 3.8% 46.1%',
            '--accent': '240 4.8% 95.9%',
            '--accent-foreground': '240 5.9% 10%',
            '--destructive': '0 84.2% 60.2%',
            '--destructive-foreground': '0 0% 98%',
            '--border': '240 5.9% 90%',
            '--input': '240 5.9% 90%',
            '--ring': '240 10% 3.9%',
          } as React.CSSProperties
        }
      >
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
                quality={90}
              />
            </div>

            {/* Post Header */}
            <header className="mb-8">
              {post.category && (
                <Badge variant="secondary" className="mb-4">
                  {post.category}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{post.author_name}</span>
                  {post.author_title && (
                    <span className="text-xs">({post.author_title})</span>
                  )}
                </div>
                {post.published_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <time dateTime={post.published_at}>
                      {new Date(post.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                )}
                {post.reading_time_minutes && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{post.reading_time_minutes} min read</span>
                  </div>
                )}
              </div>

              {post.author_bio && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {post.author_bio}
                  </p>
                </div>
              )}
            </header>

            {/* Post Content */}
            <div className="mb-8">
              {isJson ? (
                <BlogContentRenderer json={content} />
              ) : (
                <div
                  className="prose dark:prose-invert prose-baci max-w-none w-full [&_a]:!text-blue-600 [&_img:first-of-type]:hidden"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Legacy content sanitized
                  dangerouslySetInnerHTML={{ __html: legacyHtml }}
                />
              )}
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-8 pt-8 border-t">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {post.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Share */}
            <div className="flex items-center gap-4 mb-12 pb-8 border-b">
              <span className="text-sm text-muted-foreground">
                Share this article:
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`${baseUrl}/blog/${post.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twitter
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/blog/${post.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${baseUrl}/blog/${post.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Facebook
                  </a>
                </Button>
              </div>
            </div>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
                <div className="grid gap-6 md:grid-cols-3">
                  {relatedPosts.map((related) => (
                    <Link
                      key={related.id}
                      href={`${basePath}/blog/${related.slug}` as Route}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow group">
                        {related.featured_image_url && (
                          <div className="aspect-video overflow-hidden rounded-t-lg relative">
                            <Image
                              src={related.featured_image_url}
                              alt={related.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <CardHeader>
                          {related.category && (
                            <Badge variant="secondary" className="w-fit mb-2">
                              {related.category}
                            </Badge>
                          )}
                          <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                            {related.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {related.published_at && (
                              <span>
                                {new Date(
                                  related.published_at
                                ).toLocaleDateString()}
                              </span>
                            )}
                            {related.reading_time_minutes && (
                              <span>
                                {related.reading_time_minutes} min read
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
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
