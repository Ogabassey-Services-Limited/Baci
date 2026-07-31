import { FileText, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BlogDiscoverImageReadinessState } from '@/lib/blog-discover-readiness';
import type { BlogMerchant, BlogPost } from './blog-client-types';
import { BlogPostCard } from './blog-post-card';

interface BlogPostListProps {
  discoverReadinessByPostId: Map<string, BlogDiscoverImageReadinessState>;
  isLoading: boolean;
  merchant: BlogMerchant;
  onDelete: (postId: string) => void;
  onPreview: (post: BlogPost) => void;
  onStatusChange: (postId: string, status: BlogPost['status']) => void;
  posts: BlogPost[];
  searchQuery: string;
  statusFilter: string;
}

export function BlogPostList({
  discoverReadinessByPostId,
  isLoading,
  merchant,
  onDelete,
  onPreview,
  onStatusChange,
  posts,
  searchQuery,
  statusFilter,
}: BlogPostListProps) {
  if (isLoading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 aria-hidden="true" className="size-8 animate-spin" />
        <span className="sr-only" role="status">
          Loading posts
        </span>
      </div>
    );
  }

  if (posts.length === 0) {
    const hasFilter = Boolean(searchQuery || statusFilter !== 'all');
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 size-12 opacity-50" />
            <p className="mb-4">
              {hasFilter
                ? 'No posts found matching your filters'
                : 'No blog posts yet'}
            </p>
            {!hasFilter && (
              <Button asChild>
                <Link href="/dashboard/blog/new">
                  <Plus className="mr-2 size-4" />
                  Create Your First Post
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <BlogPostCard
          discoverReadiness={discoverReadinessByPostId.get(post.id)}
          key={post.id}
          merchant={merchant}
          onDelete={onDelete}
          onPreview={onPreview}
          onStatusChange={onStatusChange}
          post={post}
        />
      ))}
    </div>
  );
}
