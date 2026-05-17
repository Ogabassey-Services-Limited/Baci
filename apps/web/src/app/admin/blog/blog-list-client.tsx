'use client';

import { Loader2, PencilLine, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { deletePlatformBlogPost, listPlatformBlogPostsPage } from './blog-api';
import { PLATFORM_BLOG_PAGE_SIZE } from './blog-pagination';
import type { PlatformAdminBlogPostSummary } from './blog-types';

function formatUpdatedDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not updated';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not updated' : date.toLocaleString();
}

type BlogListClientProps = {
  initialError?: string | null;
  initialHasMore?: boolean;
  initialPosts: PlatformAdminBlogPostSummary[];
  pageSize?: number;
};

export function BlogListClient({
  initialError = null,
  initialHasMore = false,
  initialPosts,
  pageSize = PLATFORM_BLOG_PAGE_SIZE,
}: BlogListClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [posts, setPosts] =
    useState<PlatformAdminBlogPostSummary[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [errorMessage] = useState<string | null>(initialError);

  const handleDelete = async (post: PlatformAdminBlogPostSummary) => {
    if (!window.confirm(`Delete "${post.title}"?`)) {
      return;
    }

    try {
      setDeletingPostId(post.id);
      await deletePlatformBlogPost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      toast({
        title: 'Post deleted',
        description: `"${post.title}" was removed.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete post',
        variant: 'destructive',
      });
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const nextPage = await listPlatformBlogPostsPage({
        limit: pageSize,
        offset: posts.length,
      });
      setPosts((current) => {
        const seenIds = new Set(current.map((post) => post.id));
        const uniquePosts = nextPage.posts.filter(
          (post) => !seenIds.has(post.id)
        );
        return [...current, ...uniquePosts];
      });
      setHasMore(nextPage.hasMore);
    } catch (error) {
      toast({
        title: 'Load failed',
        description:
          error instanceof Error ? error.message : 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Platform Blog</h1>
          <p className="text-muted-foreground">
            Manage posts that publish to `/blog` on usebaci.com.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>
            Platform-only entries (`is_platform_post = true`, `merchant_id =
            null`).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          {!errorMessage && posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No platform posts yet.
            </p>
          ) : null}

          {!errorMessage && posts.length > 0 ? (
            <div className="space-y-3">
              {posts.map((post) => {
                const deleting = deletingPostId === post.id;
                return (
                  <div
                    key={post.id}
                    className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {post.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        /blog/{post.slug} • {post.status} • Updated{' '}
                        {formatUpdatedDate(post.updated_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/blog/${post.slug}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/blog/${post.id}/edit`}>
                          <PencilLine className="mr-1 h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleting}
                        onClick={() => handleDelete(post)}
                      >
                        {deleting ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!errorMessage && hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
