import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, ArrowLeft, Share2, Tag } from 'lucide-react';
import { generateBlogPostSchema } from '@/lib/seo-utils';
import { marked } from 'marked';
import { asRoute } from '@/lib/routes';

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

async function getPostData(merchantSlug: string, postSlug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, slug, logo_url')
    .eq('slug', merchantSlug)
    .single();

  if (!merchant) return null;

  // Check if blog is enabled
  const { data: features } = await supabase
    .from('merchant_feature_settings')
    .select('blog_enabled')
    .eq('merchant_id', merchant.id)
    .single();

  if (!features?.blog_enabled) return null;

  // Get post
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('slug', postSlug)
    .eq('status', 'published')
    .single();

  if (!post) return null;

  // Increment view count (fire and forget)
  supabase
    .from('blog_posts')
    .update({ view_count: (post.view_count || 0) + 1 })
    .eq('id', post.id)
    .then(() => {});

  // Get related posts (same category or matching tags)
  let relatedQuery = supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .neq('id', post.id)
    .limit(3);

  if (post.category) {
    relatedQuery = relatedQuery.eq('category', post.category);
  }

  const { data: relatedPosts } = await relatedQuery;

  return { merchant, post, relatedPosts: relatedPosts || [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const data = await getPostData(slug, postSlug);

  if (!data) {
    return { title: 'Post Not Found' };
  }

  const { merchant, post } = data;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || post.content.substring(0, 160);
  const url = `https://${merchant.slug}.usebaci.com/blog/${post.slug}`;

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
      images: post.featured_image_url ? [{ url: post.featured_image_url, alt: post.featured_image_alt || post.title }] : [],
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
  const data = await getPostData(slug, postSlug);

  if (!data) {
    notFound();
  }

  const { merchant, post, relatedPosts } = data;

  // Parse markdown content
  const htmlContent = await marked(post.content);

  // Generate schema
  const baseUrl = `https://${merchant.slug}.usebaci.com`;
  const blogSchema = generateBlogPostSchema({
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || post.content.substring(0, 160),
    url: `${baseUrl}/blog/${post.slug}`,
    image: post.featured_image_url || `${baseUrl}/og-image.png`,
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
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: merchant.business_name,
        item: `https://${merchant.slug}.usebaci.com`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `https://${merchant.slug}.usebaci.com/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `https://${merchant.slug}.usebaci.com/blog/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link href={asRoute(`/${slug}/blog`)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <article className="max-w-4xl mx-auto">
            {/* Featured Image */}
            {post.featured_image_url && (
              <div className="aspect-video rounded-lg overflow-hidden mb-8">
                <img
                  src={post.featured_image_url}
                  alt={post.featured_image_alt || post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Post Header */}
            <header className="mb-8">
              {post.category && (
                <Badge variant="secondary" className="mb-4">
                  {post.category}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>

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
                  <p className="text-sm text-muted-foreground">{post.author_bio}</p>
                </div>
              )}
            </header>

            {/* Post Content */}
            <div
              className="prose prose-slate dark:prose-invert max-w-none mb-8"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

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
              <span className="text-sm text-muted-foreground">Share this article:</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://${merchant.slug}.usebaci.com/blog/${post.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twitter
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://${merchant.slug}.usebaci.com/blog/${post.slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://${merchant.slug}.usebaci.com/blog/${post.slug}`)}`}
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
                    <Link key={related.id} href={`/${slug}/blog/${related.slug}`}>
                      <Card className="h-full hover:shadow-lg transition-shadow group">
                        {related.featured_image_url && (
                          <div className="aspect-video overflow-hidden rounded-t-lg">
                            <img
                              src={related.featured_image_url}
                              alt={related.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                              <span>{new Date(related.published_at).toLocaleDateString()}</span>
                            )}
                            {related.reading_time_minutes && (
                              <span>{related.reading_time_minutes} min read</span>
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
            <Link href={asRoute(`/${slug}/blog`)}>
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
