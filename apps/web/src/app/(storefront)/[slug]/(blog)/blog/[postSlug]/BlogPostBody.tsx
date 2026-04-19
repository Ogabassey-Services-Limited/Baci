import { Tag } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BlogContentRenderer } from '@/components/blog/renderer/BlogContentRenderer';
import { TableOfContents } from '@/components/blog/table-of-contents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SafeHtml } from '@/components/ui/safe-html';
import { buildBlogUrl, resolveBlogPostContent } from './blog-post-content';

export interface BlogPostBodyProps {
  basePath: string;
  baseUrl: string;
  content: unknown;
  locale?: string;
  merchantSlug: string;
  postUrl?: string;
  post: {
    author_bio?: string | null;
    id: string;
    slug: string;
    tags?: string[] | null;
    title: string;
  };
  relatedPosts: Array<{
    category?: string | null;
    featured_image_url?: string | null;
    id: string;
    published_at?: string | null;
    reading_time_minutes?: number | null;
    slug: string;
    title: string;
  }>;
}

export async function BlogPostBody({
  basePath,
  baseUrl,
  content,
  locale,
  merchantSlug,
  post,
  postUrl,
  relatedPosts,
}: BlogPostBodyProps) {
  const { isJson, legacyHtml, renderedContent } = await resolveBlogPostContent(
    content,
    {
      basePath,
      baseUrl,
      merchantSlug,
    }
  );
  const shareUrl = postUrl || buildBlogUrl(baseUrl, basePath, post.slug);

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:1152px_2400px]">
      {isJson && <TableOfContents />}

      <div className="mb-8">
        {isJson ? (
          <BlogContentRenderer
            json={renderedContent}
            basePath={basePath}
            baseUrl={baseUrl}
            merchantSlug={merchantSlug}
          />
        ) : (
          <SafeHtml
            data-testid="blog-post-legacy-content"
            html={legacyHtml}
            className="prose dark:prose-invert prose-baci max-w-none w-full [&_a]:!text-blue-600 [&_img:first-of-type]:hidden"
          />
        )}
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2 border-t pt-8">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mb-12 flex items-center gap-4 border-b pb-8">
        <span className="text-sm text-muted-foreground">
          Share this article:
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
          </Button>
        </div>
      </div>

      {relatedPosts.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-bold">Related Articles</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`${basePath}/blog/${related.slug}` as Route}
              >
                <Card className="group h-full transition-shadow hover:shadow-lg">
                  {related.featured_image_url && (
                    <div className="relative aspect-video overflow-hidden rounded-t-lg">
                      <Image
                        src={related.featured_image_url}
                        alt={related.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <CardHeader>
                    {related.category && (
                      <Badge variant="secondary" className="mb-2 w-fit">
                        {related.category}
                      </Badge>
                    )}
                    <CardTitle className="line-clamp-2 text-lg transition-colors group-hover:text-primary">
                      {related.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {related.published_at && (
                        <span>
                          {new Date(related.published_at).toLocaleDateString(
                            locale?.trim() || undefined
                          )}
                        </span>
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
    </div>
  );
}
