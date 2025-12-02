import { Calendar, Clock, Rss, User } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { asRoute } from '@/lib/routes';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

async function getMerchantAndPosts(
  merchantSlug: string,
  category?: string,
  page = 1
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const limit = 12;
  const offset = (page - 1) * limit;

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

  // Build posts query
  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, published_at, reading_time_minutes, view_count',
      { count: 'exact' }
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: posts, count } = await query;

  // Get unique categories
  const { data: categories } = await supabase
    .from('blog_posts')
    .select('category')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('category', 'is', null);

  const uniqueCategories = [
    ...new Set(categories?.map((c) => c.category).filter(Boolean)),
  ];

  return {
    merchant,
    posts: posts || [],
    totalPosts: count || 0,
    categories: uniqueCategories,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMerchantAndPosts(slug);

  if (!data) {
    return { title: 'Blog Not Found' };
  }

  return {
    title: `Blog | ${data.merchant.business_name}`,
    description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    openGraph: {
      title: `Blog | ${data.merchant.business_name}`,
      description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
      type: 'website',
    },
    alternates: {
      types: {
        'application/rss+xml': `/api/blog/feed/${slug}`,
      },
    },
  };
}

export default async function BlogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, page } = await searchParams;
  const currentPage = Number.parseInt(page || '1', 10);

  const data = await getMerchantAndPosts(slug, category, currentPage);

  if (!data) {
    notFound();
  }

  const { merchant, posts, categories, totalPages } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/${slug}`}
                className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
              >
                &larr; Back to store
              </Link>
              <h1 className="text-3xl font-bold">
                {merchant.business_name} Blog
              </h1>
              <p className="text-muted-foreground mt-2">
                Latest articles, news, and insights
              </p>
            </div>
            <a
              href={`/api/blog/feed/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Rss className="w-4 h-4" />
              RSS Feed
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href={asRoute(`/${slug}/blog`)}>
              <Badge
                variant={!category ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                All
              </Badge>
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat}
                href={asRoute(
                  `/${slug}/blog?category=${encodeURIComponent(cat)}`
                )}
              >
                <Badge
                  variant={category === cat ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {cat}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                {category
                  ? `No posts found in "${category}" category.`
                  : 'No blog posts yet. Check back soon!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/${slug}/blog/${post.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden group">
                  {post.featured_image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.featured_image_url}
                        alt={post.featured_image_alt || post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    {post.category && (
                      <Badge variant="secondary" className="w-fit mb-2">
                        {post.category}
                      </Badge>
                    )}
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    {post.excerpt && (
                      <CardDescription className="line-clamp-3">
                        {post.excerpt}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[100px]">
                          {post.author_name}
                        </span>
                      </div>
                      {post.published_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {new Date(post.published_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {post.reading_time_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{post.reading_time_minutes} min</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {currentPage > 1 && (
              <Button variant="outline" asChild>
                <Link
                  href={asRoute(
                    `/${slug}/blog?${category ? `category=${category}&` : ''}page=${currentPage - 1}`
                  )}
                >
                  Previous
                </Link>
              </Button>
            )}
            <span className="flex items-center px-4 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <Button variant="outline" asChild>
                <Link
                  href={asRoute(
                    `/${slug}/blog?${category ? `category=${category}&` : ''}page=${currentPage + 1}`
                  )}
                >
                  Next
                </Link>
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
