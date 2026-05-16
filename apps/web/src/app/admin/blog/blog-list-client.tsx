'use client';

import { Loader2, PencilLine, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { deletePlatformBlogPost, listPlatformBlogPosts } from './blog-api';
import type { PlatformAdminBlogPostSummary } from './blog-types';

function formatUpdatedDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not updated';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not updated' : date.toLocaleString();
}

export function BlogListClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PlatformAdminBlogPostSummary[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const result = await listPlatformBlogPosts();
        if (!cancelled) {
          setPosts(result);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load platform blog posts'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

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
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading posts...
            </div>
          ) : null}

          {!loading && errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          {!loading && !errorMessage && posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No platform posts yet.
            </p>
          ) : null}

          {!loading && !errorMessage && posts.length > 0 ? (
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
                        <Link href={`/blog/${post.slug}`} target="_blank">
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
        </CardContent>
      </Card>
    </div>
  );
}
