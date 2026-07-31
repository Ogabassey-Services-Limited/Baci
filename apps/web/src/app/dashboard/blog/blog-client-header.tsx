import { Plus, Rss, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { isSafeSlug } from '@/lib/validate-slug';
import type { BlogMerchant } from './blog-client-types';

interface BlogClientHeaderProps {
  autoBlogEnabled: boolean;
  merchant: BlogMerchant;
}

export function BlogClientHeader({
  autoBlogEnabled,
  merchant,
}: BlogClientHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-muted-foreground">
          Create and manage blog posts for your store
        </p>
        <div className="flex items-center gap-2">
          {merchant.slug && isSafeSlug(merchant.slug) && (
            <Button asChild size="sm" variant="outline">
              <a
                href={`/api/blog/feed/${merchant.slug}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Rss className="mr-2 size-4" />
                RSS Feed
              </a>
            </Button>
          )}
          {autoBlogEnabled && (
            <Button asChild variant="outline">
              <Link href="/dashboard/blog/ai-generator">
                <Sparkles className="mr-2 size-4" />
                AI Generator
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/blog/new">
              <Plus className="mr-2 size-4" />
              New Post
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
