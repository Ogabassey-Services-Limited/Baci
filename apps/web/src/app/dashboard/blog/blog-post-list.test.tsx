import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlogPostList } from './blog-post-list';

vi.mock('./blog-post-card', () => ({
  BlogPostCard: ({ post }: { post: { title: string } }) => (
    <div>{post.title}</div>
  ),
}));

const defaults = {
  discoverReadinessByPostId: new Map(),
  merchant: { id: 'merchant-1', slug: 'demo' },
  onDelete: vi.fn(),
  onPreview: vi.fn(),
  onStatusChange: vi.fn(),
  searchQuery: '',
  statusFilter: 'all',
};

describe('BlogPostList', () => {
  it('shows loading only while an empty list is loading', () => {
    render(<BlogPostList {...defaults} isLoading posts={[]} />);
    expect(document.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByText('No blog posts yet')).toBeNull();
  });

  it('shows a filtered empty state without the creation action', () => {
    render(
      <BlogPostList
        {...defaults}
        isLoading={false}
        posts={[]}
        searchQuery="bags"
      />
    );
    expect(
      screen.getByText('No posts found matching your filters')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /create your first post/i })
    ).toBeNull();
  });

  it('renders a card for each available post', () => {
    render(
      <BlogPostList
        {...defaults}
        isLoading={false}
        posts={[{ id: 'post-1', title: 'Summer bags' } as never]}
      />
    );
    expect(screen.getByText('Summer bags')).toBeInTheDocument();
  });
});
