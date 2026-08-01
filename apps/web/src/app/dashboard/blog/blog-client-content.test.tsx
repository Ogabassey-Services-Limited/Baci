import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useBlogClientState = vi.hoisted(() => vi.fn());

vi.mock('./use-blog-client-state', () => ({ useBlogClientState }));
vi.mock('./blog-client-header', () => ({
  BlogClientHeader: () => <div>header</div>,
}));
vi.mock('./blog-stats-filters', () => ({
  BlogStatsFilters: () => <div>filters</div>,
}));
vi.mock('./blog-post-list', () => ({ BlogPostList: () => <div>posts</div> }));
vi.mock('./blog-pagination', () => ({
  BlogPagination: () => <div>pagination</div>,
}));
vi.mock('./blog-delete-dialog', () => ({
  BlogDeleteDialog: () => <div>delete dialog</div>,
}));

import { BlogClientContent } from './blog-client-content';

describe('BlogClientContent', () => {
  it('composes extracted sections and hides pagination while loading', () => {
    useBlogClientState.mockReturnValue({
      autoBlogEnabled: false,
      changeSearch: vi.fn(),
      deletePost: vi.fn(),
      deletePostId: null,
      discoverReadiness: { byPostId: new Map(), remediationCount: 0 },
      hasMore: false,
      isLoading: true,
      page: 1,
      posts: [{ id: 'post-1' }],
      previewPost: vi.fn(),
      searchQuery: '',
      selectStatus: vi.fn(),
      setDeletePostId: vi.fn(),
      setPage: vi.fn(),
      showDiscoverRemediation: vi.fn(),
      stats: { drafts: 0, pageViews: 0, published: 1, total: 1 },
      statusFilter: 'all',
      updatePostStatus: vi.fn(),
    });

    render(<BlogClientContent merchant={{ id: 'merchant-1' }} />);

    expect(screen.getByText('header')).toBeInTheDocument();
    expect(screen.getByText('filters')).toBeInTheDocument();
    expect(screen.getByText('posts')).toBeInTheDocument();
    expect(screen.queryByText('pagination')).toBeNull();
  });
});
