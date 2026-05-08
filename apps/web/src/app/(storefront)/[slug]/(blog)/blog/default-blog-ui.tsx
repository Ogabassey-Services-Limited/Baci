import { Rss } from 'lucide-react';
import Link from 'next/link';
import { AdUnit } from '@/components/storefront/ogabassey/components/AdUnit';
import { Badge } from '@/components/ui/badge';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { BlogList } from './blog-list';

interface BlogListPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  tags: string[] | null;
  author_name: string | null;
  published_at: string;
  reading_time_minutes: number | null;
  view_count: number | null;
}

interface DefaultBlogUiProps {
  blogSchema: Record<string, unknown>;
  breadcrumbSchema: Record<string, unknown>;
  basePath: string;
  categories: string[];
  category?: string;
  merchant: {
    id: string;
    business_name: string;
  };
  posts: BlogListPost[];
  searchQuery?: string;
  slug: string;
  totalPosts: number;
}

export function DefaultBlogUi({
  blogSchema,
  breadcrumbSchema,
  basePath,
  categories,
  category,
  merchant,
  posts,
  searchQuery,
  slug,
  totalPosts,
}: DefaultBlogUiProps) {
  return (
    <>
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
      <div className="min-h-screen bg-background">
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
                    href={asRoute(`${basePath}/blog`)}
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
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              <Link href={asRoute(`${basePath}/blog`)}>
                <Badge
                  variant={!category ? 'default' : 'outline-solid'}
                  className="cursor-pointer"
                >
                  All
                </Badge>
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={asRoute(
                    `${basePath}/blog?category=${encodeURIComponent(cat)}`
                  )}
                >
                  <Badge
                    variant={category === cat ? 'default' : 'outline-solid'}
                    className="cursor-pointer"
                  >
                    {cat}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="mb-8 flex justify-center">
            <AdUnit placementKey="BLOG_SIDEBAR" />
          </div>

          <BlogList
            initialPosts={posts}
            merchantId={merchant.id}
            totalPosts={totalPosts}
            category={category}
            searchQuery={searchQuery}
            basePath={basePath}
          />
        </main>
      </div>
    </>
  );
}
