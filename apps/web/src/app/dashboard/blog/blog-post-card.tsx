import { format, formatDistanceToNow } from 'date-fns';
import {
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BlogDiscoverImageReadinessState } from '@/lib/blog-discover-readiness';
import { asRoute } from '@/lib/routes';
import { isSafeSlug } from '@/lib/validate-slug';
import type { BlogMerchant, BlogPost } from './blog-client-types';
import { BlogDiscoverReadinessBadge } from './blog-discover-readiness-badge';
import { BlogPostStatusBadge } from './blog-post-status-badge';

interface BlogPostCardProps {
  discoverReadiness?: BlogDiscoverImageReadinessState;
  merchant: BlogMerchant;
  onDelete: (postId: string) => void;
  onPreview: (post: BlogPost) => void;
  onStatusChange: (postId: string, status: BlogPost['status']) => void;
  post: BlogPost;
}

export function BlogPostCard({
  discoverReadiness,
  merchant,
  onDelete,
  onPreview,
  onStatusChange,
  post,
}: BlogPostCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {post.featured_image_url && (
            <div className="relative hidden size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:block">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="96px"
                src={post.featured_image_url}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <BlogPostStatusBadge status={post.status} />
              {post.status === 'published' &&
                discoverReadiness &&
                discoverReadiness !== 'ready' && (
                  <BlogDiscoverReadinessBadge state={discoverReadiness} />
                )}
              {post.category && (
                <Badge variant="outline">{post.category}</Badge>
              )}

              <h3 className="mb-1 truncate font-semibold text-lg">
                <Link
                  className="transition-colors hover:text-accent"
                  href={asRoute(`/dashboard/blog/${post.id}/edit`)}
                >
                  {post.title}
                </Link>
              </h3>

              {post.excerpt && (
                <p className="mb-2 line-clamp-2 text-muted-foreground text-sm">
                  {post.excerpt}
                </p>
              )}

              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPreview(post)}>
                  <Eye className="mr-2 size-4" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={asRoute(`/dashboard/blog/${post.id}/edit`)}>
                    <Edit className="mr-2 size-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {post.status === 'published' &&
                  merchant.slug &&
                  isSafeSlug(merchant.slug) && (
                    <DropdownMenuItem asChild>
                      <a
                        href={
                          merchant.custom_domain
                            ? `https://${merchant.custom_domain}/blog/${post.slug}`
                            : `/${merchant.slug}/blog/${post.slug}`
                        }
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="mr-2 size-4" />
                        View Live
                      </a>
                    </DropdownMenuItem>
                  )}
                <DropdownMenuSeparator />
                {post.status === 'draft' && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(post.id, 'published')}
                  >
                    <CheckCircle className="mr-2 size-4" />
                    Publish
                  </DropdownMenuItem>
                )}
                {post.status === 'published' && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(post.id, 'draft')}
                  >
                    <Clock className="mr-2 size-4" />
                    Unpublish
                  </DropdownMenuItem>
                )}
                {post.status !== 'archived' && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(post.id, 'archived')}
                  >
                    <Archive className="mr-2 size-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(post.id)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
