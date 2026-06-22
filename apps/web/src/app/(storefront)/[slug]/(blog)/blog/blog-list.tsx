import { Calendar, Clock, User } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { formatBlogListDateLabel } from './blog-date-label';

interface BlogPost {
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

interface BlogListProps {
  initialPosts: BlogPost[];
  totalPosts: number;
  category?: string;
  basePath: string;
  initialPage?: number;
}

export function BlogList({
  initialPosts: posts,
  totalPosts,
  category,
  basePath,
  initialPage = 1,
}: BlogListProps) {
  if (posts.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent>
          <p className="text-muted-foreground">
            {category
              ? `No posts found in "${category}" category.`
              : 'No blog posts yet. Check back soon!'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasMoreServerPages =
    initialPage <= 1 && totalPosts > BLOG_LISTING_PAGE_SIZE;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => {
          const publishedDateLabel = formatBlogListDateLabel(post.published_at);
          const isListingLcpCandidate =
            index === 0 && !!post.featured_image_url;

          return (
            <Link key={post.id} href={`${basePath}/blog/${post.slug}` as Route}>
              <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
                {post.featured_image_url && (
                  <div className="relative aspect-video overflow-hidden">
                    <Image
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      preload={isListingLcpCandidate}
                    />
                  </div>
                )}
                <CardHeader>
                  {post.category && (
                    <Badge variant="secondary" className="mb-2 w-fit">
                      {post.category}
                    </Badge>
                  )}
                  <CardTitle className="line-clamp-2 transition-colors group-hover:text-primary">
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
                      <User className="size-3.5" />
                      <span className="max-w-[100px] truncate">
                        {post.author_name}
                      </span>
                    </div>
                    {publishedDateLabel && (
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        <time dateTime={post.published_at}>
                          {publishedDateLabel}
                        </time>
                      </div>
                    )}
                    {post.reading_time_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        <span>{post.reading_time_minutes} min</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {hasMoreServerPages && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Showing {posts.length} of {totalPosts} articles
        </p>
      )}
    </>
  );
}
