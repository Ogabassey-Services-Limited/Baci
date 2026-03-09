import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Calendar, Clock, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { SafeHtml } from '@/components/ui/safe-html';
import { asRoute } from '@/lib/routes';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  tags: string[];
  keywords: string[];
  author_name: string;
  author_title: string | null;
  author_image_url: string | null;
  author_bio: string | null;
  reading_time_minutes: number | null;
  published_at: string;
  view_count: number;
  seo_title: string | null;
  seo_description: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials not configured');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: post, error } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, category, tags, keywords, author_name, author_title, author_image_url, author_bio, reading_time_minutes, published_at, view_count, seo_title, seo_description'
    )
    .eq('is_platform_post', true)
    .eq('status', 'published')
    .eq('slug', slug)
    .single();

  if (error || !post) {
    return null;
  }

  return post;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found - Baci Blog',
    };
  }

  return {
    title: post.seo_title || `${post.title} - Baci Blog`,
    description: post.seo_description || post.excerpt,
    keywords: post.keywords?.join(', '),
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt,
      type: 'article',
      publishedTime: post.published_at,
      authors: [post.author_name],
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt,
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
    },
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  // Increment view count only here (not in getBlogPost, which is also called by generateMetadata)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    void Promise.resolve(
      supabase.rpc('increment_blog_post_views', { p_post_id: post.id })
    ).catch(() => {
      // View count is non-critical — silently ignore failures
    });
  }

  return (
    <AppBody>
      <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-accent/30">
        <PlatformHeader />
        <main className="flex-1 pt-24 pb-16">
          <article className="container px-4 md:px-6 max-w-4xl mx-auto">
            {/* Back link */}
            <Link
              href={asRoute('/blog')}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            {/* Header */}
            <header className="mb-8">
              {post.category && (
                <span className="inline-block text-sm font-medium text-accent mb-4">
                  {post.category}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                {post.title}
              </h1>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.published_at)}
                </span>
                {post.reading_time_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.reading_time_minutes} min read
                  </span>
                )}
                {post.view_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {post.view_count} views
                  </span>
                )}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                {post.author_image_url ? (
                  <Image
                    src={post.author_image_url}
                    alt={post.author_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                    {post.author_name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium">{post.author_name}</p>
                  {post.author_title && (
                    <p className="text-sm text-muted-foreground">
                      {post.author_title}
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Featured image */}
            {post.featured_image_url && (
              <div className="relative aspect-video mb-8 rounded-2xl overflow-hidden">
                <Image
                  src={post.featured_image_url}
                  alt={post.featured_image_alt || post.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Content */}
            <SafeHtml
              html={post.content}
              className="prose prose-lg dark:prose-invert max-w-none mb-12"
            />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-muted rounded-full text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Author bio */}
            {post.author_bio && (
              <div className="border-t pt-8 mt-8">
                <h3 className="text-lg font-semibold mb-4">About the Author</h3>
                <div className="flex items-start gap-4">
                  {post.author_image_url ? (
                    <Image
                      src={post.author_image_url}
                      alt={post.author_name}
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
                      {post.author_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-lg">{post.author_name}</p>
                    {post.author_title && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {post.author_title}
                      </p>
                    )}
                    <p className="text-muted-foreground">{post.author_bio}</p>
                  </div>
                </div>
              </div>
            )}
          </article>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}
