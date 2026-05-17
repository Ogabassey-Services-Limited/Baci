import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformAdminBlogPostSummary } from './blog-types';

const mockRefresh = vi.fn();
const mockToast = vi.fn();
const mockDeletePlatformBlogPost = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./blog-api', () => ({
  deletePlatformBlogPost: (...args: unknown[]) =>
    mockDeletePlatformBlogPost(...args),
}));

import { BlogListClient } from './blog-list-client';

const samplePosts: PlatformAdminBlogPostSummary[] = [
  {
    id: 'post-1',
    published_at: null,
    slug: 'launch-faster',
    status: 'draft',
    title: 'Launch Faster',
    updated_at: '2026-05-16T00:00:00.000Z',
  },
];

describe('BlogListClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  it('renders empty state when no posts exist', () => {
    render(<BlogListClient initialPosts={[]} />);

    expect(screen.getByText('No platform posts yet.')).toBeInTheDocument();
  });

  it('renders initial server-provided posts', () => {
    render(<BlogListClient initialPosts={samplePosts} />);

    expect(screen.getByText('Launch Faster')).toBeInTheDocument();
    expect(screen.getByText(/\/blog\/launch-faster/)).toBeInTheDocument();
  });

  it('shows initial error message when server fetch fails', () => {
    render(
      <BlogListClient
        initialError="Failed to load platform blog posts"
        initialPosts={[]}
      />
    );

    expect(
      screen.getByText('Failed to load platform blog posts')
    ).toBeInTheDocument();
  });

  it('deletes a post and refreshes router on success', async () => {
    mockDeletePlatformBlogPost.mockResolvedValueOnce(undefined);

    render(<BlogListClient initialPosts={samplePosts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeletePlatformBlogPost).toHaveBeenCalledWith('post-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Launch Faster')).not.toBeInTheDocument();
    });
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Post deleted',
      })
    );
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );

    render(<BlogListClient initialPosts={samplePosts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeletePlatformBlogPost).not.toHaveBeenCalled();
  });

  it('shows destructive toast when delete fails', async () => {
    mockDeletePlatformBlogPost.mockRejectedValueOnce(
      new Error('delete failed')
    );

    render(<BlogListClient initialPosts={samplePosts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeletePlatformBlogPost).toHaveBeenCalledWith('post-1');
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete failed',
        variant: 'destructive',
      })
    );
  });
});
