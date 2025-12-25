import { Calendar, Clock, Rss, User } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AdUnit } from '@/components/storefront/ogabassey/components/AdUnit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getCachedFeatureSettings,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';
import { type BlogPostData, getTemplate } from '@/templates/registry';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string; search?: string }>;
}

const getMerchantAndPosts = cache(
  async (
    identifier: string,
    category?: string,
    page = 1,
    searchQuery?: string
  ) => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const limit = 12;
    const offset = (page - 1) * limit;

    // Get merchant - support both slugs and custom domains
    // Custom domains (like ogabassey.com) are rewritten by proxy.ts
    const lookupKey = identifier.toLowerCase();
    const cachedMerchant = isDomainIdentifier(identifier)
      ? await getCachedMerchantByDomain(lookupKey)
      : await getCachedMerchant(lookupKey);

    if (!cachedMerchant) return null;

    // Map cached merchant to the format we need
    const merchant = {
      id: cachedMerchant.id,
      business_name: cachedMerchant.business_name,
      slug: cachedMerchant.slug,
      logo_url: cachedMerchant.logo_url,
      template_id: cachedMerchant.template_id,
    };

    // Check if blog is enabled using cached settings
    const features = await getCachedFeatureSettings(merchant.id);
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

    // Add search filter if provided using PostgreSQL full-text search
    if (searchQuery) {
      const sanitizedSearch = searchQuery.trim().slice(0, 100);

      if (sanitizedSearch) {
        // Use PostgreSQL full-text search with search_vector (GIN indexed)
        // This is ~10-100x faster than ILIKE for larger datasets
        // Falls back to ILIKE for trigram fuzzy matching on title if FTS returns no results
        query = query.textSearch('search_vector', sanitizedSearch, {
          type: 'websearch', // Handles phrases and operators naturally
          config: 'english',
        });
      }
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
      searchQuery,
    };
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMerchantAndPosts(slug);

  if (!data) {
    return { title: 'Blog Not Found' };
  }

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${data.merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const canonicalUrl = `${baseUrl}/blog`;

  return {
    title: `Blog | ${data.merchant.business_name}`,
    description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    openGraph: {
      title: `Blog | ${data.merchant.business_name}`,
      description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Blog | ${data.merchant.business_name}`,
      description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    },
    alternates: {
      canonical: canonicalUrl,
      types: {
        'application/rss+xml': `${baseUrl}/api/blog/feed/${slug}`,
      },
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

export default async function BlogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, page, search } = await searchParams;
  const currentPage = Number.parseInt(page || '1', 10);

  const data = await getMerchantAndPosts(slug, category, currentPage, search);

  if (!data) {
    notFound();
  }

  const { merchant, posts, categories, totalPages, searchQuery } = data;

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${merchant.slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Generate Blog schema with ItemList for SEO
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${merchant.business_name} Blog`,
    description: `Read the latest articles, news, and insights from ${merchant.business_name}.`,
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: merchant.business_name,
      logo: merchant.logo_url
        ? {
            '@type': 'ImageObject',
            url: merchant.logo_url,
          }
        : undefined,
    },
    blogPost: posts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt || '',
      url: `${baseUrl}/blog/${post.slug}`,
      datePublished: post.published_at,
      author: {
        '@type': 'Person',
        name: post.author_name || merchant.business_name,
      },
      image: post.featured_image_url || undefined,
    })),
  };

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
  ]);

  // Check if merchant has a template with a custom Blog component
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Blog) {
          const BlogComponent = components.Blog;
          // Map posts to BlogPostData format
          const blogPosts: BlogPostData[] = posts.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt || '',
            category: p.category || '',
            author_name: p.author_name || merchant.business_name,
            published_at: p.published_at,
            featured_image_url: p.featured_image_url || '',
            reading_time_minutes: p.reading_time_minutes || 3,
          }));

          return (
            <>
              <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
                dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
              />
              <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(breadcrumbSchema),
                }}
              />
              <BlogComponent
                storeSlug={slug}
                posts={blogPosts}
                categories={categories}
                searchQuery={searchQuery}
              />
            </>
          );
        }
      } catch (error) {
        // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
        console.error(
          'Failed to load Blog component for template',
          templateId,
          ':',
          error
        );
        // Fall through to default blog
      }
    }
  }

  // Default blog UI (generic styling) - header is provided by OgabasseyLayout
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="min-h-screen bg-background">
        {/* Page Header */}
        <div className="bg-card border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  {searchQuery
                    ? `Search results for "${searchQuery}"`
                    : `${merchant.business_name} Blog`}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {searchQuery
                    ? `${posts.length} post${posts.length !== 1 ? 's' : ''} found`
                    : 'Latest articles, news, and insights'}
                </p>
                {searchQuery && (
                  <Link
                    href={asRoute(`/${slug}/blog`)}
                    className="text-sm text-primary hover:underline mt-2 inline-block"
                  >
                    Clear search
                  </Link>
                )}
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
        </div>

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

          {/* Ad Placement: Blog Header MPU */}
          <div className="mb-8 flex justify-center">
            <AdUnit placementKey="BLOG_SIDEBAR" />
          </div>

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
                      <div className="aspect-video overflow-hidden relative">
                        <Image
                          src={post.featured_image_url}
                          alt={post.featured_image_alt || post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
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
    </>
  );
}
