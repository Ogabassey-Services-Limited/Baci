'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Rss,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchantFeatures } from '@/hooks/use-merchant-features';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { asRoute } from '@/lib/routes';
import { isSafeSlug } from '@/lib/validate-slug';
import { getPreviewUrl } from './actions';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  author_name: string;
  view_count: number;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BlogClientPageProps {
  merchant: {
    id: string;
    slug?: string | null;
    custom_domain?: string | null;
  };
  initialPosts?: BlogPost[];
  initialCounts?: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
}

export function BlogClientPage({
  merchant,
  initialPosts = [],
  initialCounts = undefined,
}: BlogClientPageProps) {
  const _router = useRouter();
  const { toast } = useToast();
  const { autoBlogEnabled } = useMerchantFeatures();

  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(initialPosts.length === 0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const ITEMS_PER_PAGE = 20;

  const [statsData, setStatsData] = useState<
    | {
        total: number;
        published: number;
        draft: number;
        archived: number;
      }
    | null
    | undefined
  >(initialCounts);

  const fetchPosts = async () => {
    if (!merchant?.id) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const offset = (page - 1) * ITEMS_PER_PAGE;
      params.set('limit', ITEMS_PER_PAGE.toString());
      params.set('offset', offset.toString());

      const response = await fetch(`/api/merchant/blog/posts?${params}`);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.error || `Failed to fetch posts (${response.status})`
        );
      }

      const data = await response.json();
      setPosts(data.posts || []);
      setHasMore(data.hasMore);

      if (data.counts) {
        setStatsData(data.counts);
      }
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog posts.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (post: BlogPost) => {
    if (!merchant?.slug) {
      toast({
        title: 'Error',
        description: 'Merchant slug not found.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const previewUrl = await getPreviewUrl(merchant.slug, post.slug);
      window.open(previewUrl, '_blank');
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: listing actual deps instead of fetchPosts avoids infinite loop without React Compiler (e.g. in tests)
  useEffect(() => {
    fetchPosts();
  }, [merchant?.id, statusFilter, debouncedSearch, page]);

  const handleDelete = async () => {
    if (!deletePostId) return;

    const previousPosts = [...posts];
    const idToDelete = deletePostId;

    // Optimistic update
    setPosts((prev) => prev.filter((p) => p.id !== idToDelete));
    setDeletePostId(null);

    try {
      const response = await fetchWithCsrf(
        `/api/merchant/blog/posts/${idToDelete}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      toast({
        title: 'Post Deleted',
        description: 'The blog post has been permanently deleted.',
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      // Rollback on error
      setPosts(previousPosts);
      toast({
        title: 'Error',
        description: 'Failed to delete blog post. The list has been restored.',
        variant: 'destructive',
      });
    }
  };

  const updatePostStatus = async (
    postId: string,
    status: 'draft' | 'published' | 'archived'
  ) => {
    try {
      const response = await fetchWithCsrf(
        `/api/merchant/blog/posts/${postId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      const updatedPost = await response.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
      );

      toast({
        title:
          status === 'published'
            ? 'Post Published'
            : status === 'archived'
              ? 'Post Archived'
              : 'Post Unpublished',
        description: `The blog post has been ${status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'moved to drafts'}.`,
      });
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to update blog post.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="w-3 h-3 mr-1" /> Published
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="secondary">
            <Archive className="w-3 h-3 mr-1" /> Archived
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" /> Draft
          </Badge>
        );
    }
  };

  const postsCount = posts.length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const totalViewsCount = posts.reduce(
    (sum, p) => sum + (p.view_count || 0),
    0
  );

  const stats = {
    total: statsData?.total ?? postsCount,
    published: statsData?.published ?? publishedCount,
    drafts: statsData?.draft ?? draftCount,
    totalViews: totalViewsCount,
  };

  // Show loading state while checking features
  // Show loading state while checking features.
  // actually, since server already gated us, we might not strictly need this,
  // but keeping it for autoBlogEnabled loading if needed for that button.
  // However, user wants the page to show.
  // The 'isFeaturesLoading' blocks the whole page.
  // Let's remove this blocking loader too if we trust server.
  // But 'autoBlogEnabled' might be needed.
  // Let's just render. The 'autoBlogEnabled' button will just pop in when ready.

  // REMOVED: isFeaturesLoading block
  // REMOVED: (!blogEnabled) block

  return (
    <div className="w-full space-y-6 px-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
          <p className="text-muted-foreground">
            Create and manage blog posts for your store
          </p>
          <div className="flex items-center gap-2">
            {merchant?.slug && isSafeSlug(merchant.slug) && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/blog/feed/${merchant.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Rss className="w-4 h-4 mr-2" />
                  RSS Feed
                </a>
              </Button>
            )}
            {autoBlogEnabled && (
              <Button variant="outline" asChild>
                <Link href="/dashboard/blog/ai-generator">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generator
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/dashboard/blog/new">
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Total Posts</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'published' ? 'ring-2 ring-green-600' : ''
          }`}
          onClick={() => {
            setStatusFilter('published');
            setPage(1);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {stats.published}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'draft' ? 'ring-2 ring-yellow-600' : ''
          }`}
          onClick={() => {
            setStatusFilter('draft');
            setPage(1);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {stats.drafts}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-2xl">
              {stats.totalViews.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1); // Reset to first page on search
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1); // Reset to first page on filter change
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No posts found matching your filters'
                  : 'No blog posts yet'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild>
                  <Link href="/dashboard/blog/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Post
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {post.featured_image_url && (
                    <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                      <Image
                        src={post.featured_image_url}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(post.status)}
                      {post.category && (
                        <Badge variant="outline">{post.category}</Badge>
                      )}

                      <h3 className="font-semibold text-lg mb-1 truncate">
                        <Link
                          href={asRoute(`/dashboard/blog/${post.id}/edit`)}
                          className="hover:text-accent transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h3>

                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {post.published_at
                            ? format(new Date(post.published_at), 'MMM d, yyyy')
                            : `Updated ${formatDistanceToNow(new Date(post.updated_at))} ago`}
                        </span>
                        <span>by {post.author_name}</span>
                        {post.reading_time_minutes && (
                          <span>{post.reading_time_minutes} min read</span>
                        )}
                        <span>{post.view_count.toLocaleString()} views</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(post)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={asRoute(`/dashboard/blog/${post.id}/edit`)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {post.status === 'published' &&
                          merchant?.slug &&
                          isSafeSlug(merchant.slug) && (
                            <DropdownMenuItem asChild>
                              <a
                                href={
                                  merchant.custom_domain
                                    ? `https://${merchant.custom_domain}/blog/${post.slug}`
                                    : `/${merchant.slug}/blog/${post.slug}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Live
                              </a>
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuSeparator />
                        {post.status === 'draft' && (
                          <DropdownMenuItem
                            onClick={() =>
                              updatePostStatus(post.id, 'published')
                            }
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Publish
                          </DropdownMenuItem>
                        )}
                        {post.status === 'published' && (
                          <DropdownMenuItem
                            onClick={() => updatePostStatus(post.id, 'draft')}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Unpublish
                          </DropdownMenuItem>
                        )}
                        {post.status !== 'archived' && (
                          <DropdownMenuItem
                            onClick={() =>
                              updatePostStatus(post.id, 'archived')
                            }
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletePostId(post.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Pagination Controls */}
      {!isLoading && posts.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(page * ITEMS_PER_PAGE, stats.total)} of {stats.total}{' '}
            results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletePostId}
        onOpenChange={() => setDeletePostId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this blog post? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
