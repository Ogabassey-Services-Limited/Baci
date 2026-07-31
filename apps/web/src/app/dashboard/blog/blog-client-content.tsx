'use client';

import { BlogClientHeader } from './blog-client-header';
import type { BlogCounts, BlogMerchant, BlogPost } from './blog-client-types';
import { BlogDeleteDialog } from './blog-delete-dialog';
import { BlogPagination } from './blog-pagination';
import { BlogPostList } from './blog-post-list';
import { BlogStatsFilters } from './blog-stats-filters';
import { useBlogClientState } from './use-blog-client-state';

interface BlogClientContentProps {
  initialCounts?: BlogCounts;
  initialPosts?: BlogPost[];
  merchant: BlogMerchant;
}

export function BlogClientContent({
  initialCounts,
  initialPosts,
  merchant,
}: BlogClientContentProps) {
  const state = useBlogClientState({
    initialCounts,
    initialPosts: initialPosts ?? [],
    merchant,
    useInitialData: initialPosts !== undefined || initialCounts !== undefined,
  });
  return (
    <div className="w-full space-y-6 px-1">
      <BlogClientHeader
        autoBlogEnabled={state.autoBlogEnabled}
        merchant={merchant}
      />
      <BlogStatsFilters
        discoverRemediationCount={state.discoverReadiness.remediationCount}
        onDiscoverRemediation={state.showDiscoverRemediation}
        onSearchChange={state.changeSearch}
        onStatusChange={state.selectStatus}
        searchQuery={state.searchQuery}
        stats={state.stats}
        statusFilter={state.statusFilter}
      />
      <BlogPostList
        discoverReadinessByPostId={state.discoverReadiness.byPostId}
        isLoading={state.isLoading}
        merchant={merchant}
        onDelete={state.setDeletePostId}
        onPreview={state.previewPost}
        onStatusChange={state.updatePostStatus}
        posts={state.posts}
        searchQuery={state.searchQuery}
        statusFilter={state.statusFilter}
      />
      {!state.isLoading && state.posts.length > 0 && (
        <BlogPagination
          hasMore={state.hasMore}
          page={state.page}
          setPage={state.setPage}
          total={state.stats.total}
        />
      )}
      <BlogDeleteDialog
        onConfirm={state.deletePost}
        onOpenChange={(open) => {
          if (!open) state.setDeletePostId(null);
        }}
        open={Boolean(state.deletePostId)}
      />
    </div>
  );
}
