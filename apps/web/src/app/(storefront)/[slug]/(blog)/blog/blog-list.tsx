'use client';

import { Calendar, Clock, Loader2, User } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { fetchMorePosts } from './actions';
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
  merchantId: string;
  totalPosts: number;
  category?: string;
  searchQuery?: string;
  basePath: string;
  initialPage?: number;
}

export function BlogList({
  initialPosts,
  merchantId,
  totalPosts,
  category,
  searchQuery,
  basePath,
  initialPage = 1,
}: BlogListProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [page, setPage] = useState(initialPage);
  const shouldAutoLoadMore = initialPage <= 1;
  const shouldShowEndMarker = initialPage <= 1;
  const [hasMore, setHasMore] = useState(
    shouldAutoLoadMore && initialPage * BLOG_LISTING_PAGE_SIZE < totalPosts
  );
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  // The IntersectionObserver effect only re-runs when hasMore/isPending change;
  // keeping a ref to the latest `loadMore` closure avoids calling a stale one
  // that captures yesterday's `page`/`posts`.
  const loadMoreRef = useRef<(() => void) | null>(null);

  // Reset state when filters change — adjusted inline during render with a
  // prev-prop comparison so users never see one frame of the stale list.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitialPosts, setPrevInitialPosts] = useState(initialPosts);
  const [prevTotalPosts, setPrevTotalPosts] = useState(totalPosts);
  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (
    initialPosts !== prevInitialPosts ||
    totalPosts !== prevTotalPosts ||
    initialPage !== prevInitialPage
  ) {
    setPrevInitialPosts(initialPosts);
    setPrevTotalPosts(totalPosts);
    setPrevInitialPage(initialPage);
    setPosts(initialPosts);
    setPage(initialPage);
    setHasMore(
      initialPage <= 1 && initialPage * BLOG_LISTING_PAGE_SIZE < totalPosts
    );
  }

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      try {
        const newPosts = await fetchMorePosts(
          merchantId,
          nextPage,
          category,
          searchQuery
        );

        if (newPosts.length === 0) {
          setHasMore(false);
        } else {
          // Compute hasMore based on the updated post count, not a stale
          // `posts.length` captured from this closure — rapid pagination
          // can enqueue multiple loadMores before the outer state
          // propagates, giving incorrect hasMore reads.
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const uniqueNewPosts = newPosts.filter(
              (p) => !existingIds.has(p.id)
            );
            const next = [...prev, ...uniqueNewPosts];
            if (next.length >= totalPosts) {
              setHasMore(false);
            }
            return next;
          });
          setPage(nextPage);
        }
      } catch (error) {
        console.error('Failed to load more posts:', error);
      }
    });
  };

  // Keep the ref pointed at the current `loadMore` so the observer effect's
  // callback always invokes the latest closure (page/posts). Written in an
  // effect (not during render) because refs must not be touched mid-render.
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isPending) {
          loadMoreRef.current?.();
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isPending]);

  return (
    <>
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
          {posts.map((post) => {
            const publishedDateLabel = formatBlogListDateLabel(
              post.published_at
            );

            return (
              <Link
                key={post.id}
                href={`${basePath}/blog/${post.slug}` as Route}
              >
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden group">
                  {post.featured_image_url && (
                    <div className="aspect-video overflow-hidden relative">
                      <Image
                        src={post.featured_image_url}
                        alt={post.featured_image_alt || post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                        <User className="size-3.5" />
                        <span className="truncate max-w-[100px]">
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
      )}

      {(hasMore || isPending) && (
        <div
          ref={sentinelRef}
          className="flex justify-center items-center py-12"
        >
          {isPending && (
            <Loader2 className="size-8 animate-spin text-primary" />
          )}
        </div>
      )}

      {shouldShowEndMarker && !hasMore && posts.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          You've reached the end
        </div>
      )}
    </>
  );
}
