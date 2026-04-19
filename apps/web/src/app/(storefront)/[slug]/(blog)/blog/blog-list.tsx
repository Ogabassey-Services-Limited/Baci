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
import { fetchMorePosts } from './actions';

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
}

export function BlogList({
  initialPosts,
  merchantId,
  totalPosts,
  category,
  searchQuery,
  basePath,
}: BlogListProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length < totalPosts);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset state when filters change
  useEffect(() => {
    setPosts(initialPosts);
    setPage(1);
    setHasMore(initialPosts.length < totalPosts);
  }, [initialPosts, totalPosts]);

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
          setPosts((prev) => {
            // Deduplicate posts based on ID to be safe
            const existingIds = new Set(prev.map((p) => p.id));
            const uniqueNewPosts = newPosts.filter(
              (p) => !existingIds.has(p.id)
            );
            return [...prev, ...uniqueNewPosts];
          });
          setPage(nextPage);
          if (posts.length + newPosts.length >= totalPosts) {
            setHasMore(false);
          }
        }
      } catch (error) {
        console.error('Failed to load more posts:', error);
      }
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isPending) {
          loadMore();
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
          {posts.map((post) => (
            <Link key={post.id} href={`${basePath}/blog/${post.slug}` as Route}>
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

      {(hasMore || isPending) && (
        <div
          ref={sentinelRef}
          className="flex justify-center items-center py-12"
        >
          {isPending && (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          )}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          You've reached the end
        </div>
      )}
    </>
  );
}
