import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  mockToast,
  setupBlogClientPageTests,
  useMerchantFeatures,
} from './blog-client-page.test-support';

describe('BlogClientPage rendering and data states', () => {
  setupBlogClientPageTests();

  it('renders an unavailable merchant state without reading merchant features', () => {
    render(<BlogClientPage merchant={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Merchant context is unavailable.'
    );
    expect(useMerchantFeatures).not.toHaveBeenCalled();
  });

  it('renders heading, stats cards, and New Post button', () => {
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /^Blog$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create and manage blog posts/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Total Posts')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new post/i })).toHaveAttribute(
      'href',
      '/dashboard/blog/new'
    );
  });

  it('renders initial posts when provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        posts: mockPosts,
        hasMore: false,
        counts: mockCounts,
      }),
    } as Response);

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(await screen.findByText('First Blog Post')).toBeInTheDocument();
    expect(screen.getByText('Draft Post')).toBeInTheDocument();
    expect(screen.getByText('This is the first post')).toBeInTheDocument();
    expect(screen.getByText('This is a draft')).toBeInTheDocument();
  });

  it('shows loading while an initially empty list is fetching', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        posts: mockPosts,
        hasMore: false,
        counts: mockCounts,
      }),
    } as Response);

    render(<BlogClientPage merchant={mockMerchant} />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(await screen.findByText('First Blog Post')).toBeInTheDocument();
  });

  it('shows the unfiltered empty state and creation link', async () => {
    render(
      <BlogClientPage
        initialCounts={{ total: 0, published: 0, draft: 0, archived: 0 }}
        initialPosts={[]}
        merchant={mockMerchant}
      />
    );

    expect(await screen.findByText(/no blog posts yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create your first post/i })
    ).toHaveAttribute('href', '/dashboard/blog/new');
  });

  it('shows the AI generator and RSS links when enabled and safe', () => {
    vi.mocked(useMerchantFeatures).mockReturnValue({
      autoBlogEnabled: true,
      blogEnabled: true,
      isLoading: false,
    } as ReturnType<typeof useMerchantFeatures>);

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(screen.getByRole('link', { name: /ai generator/i })).toHaveAttribute(
      'href',
      '/dashboard/blog/ai-generator'
    );
    expect(screen.getByRole('link', { name: /rss feed/i })).toHaveAttribute(
      'href',
      '/api/blog/feed/test-merchant'
    );
  });

  it('shows Discover remediation for published posts only', () => {
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(
      screen.getByText('1 published post needs Discover image updates.')
    ).toBeInTheDocument();
    expect(screen.getByText('Update image metadata')).toBeInTheDocument();
  });

  it('calculates total views from posts when counts are absent', () => {
    render(<BlogClientPage initialPosts={mockPosts} merchant={mockMerchant} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it.each([
    ['network failure', () => Promise.reject(new Error('Network error'))],
    [
      'non-OK response',
      () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        } as Response),
    ],
  ])('shows an error toast after a %s', async (_case, response) => {
    vi.mocked(fetch).mockImplementation(response);

    render(<BlogClientPage merchant={mockMerchant} />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to load blog posts.',
          variant: 'destructive',
        })
      );
    });
  });
});
