import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogClientPage, type BlogPost } from './blog-client-page';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
  }) => (
    <div
      data-testid="mock-image"
      data-src={src}
      data-alt={alt}
      data-fill={fill}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-merchant-features', () => ({
  useMerchantFeatures: vi.fn(() => ({
    autoBlogEnabled: false,
  })),
}));

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: vi.fn((value) => value), // Return value immediately for tests
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((url: string) => url),
}));

vi.mock('@/lib/validate-slug', () => ({
  isSafeSlug: vi.fn(() => true),
}));

vi.mock('./actions', () => ({
  getPreviewUrl: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  CSRF_HEADER_NAME: 'x-csrf-token',
  getClientCsrfToken: vi.fn(() => 'test-csrf-token'),
}));

import { useMerchantFeatures } from '@/hooks/use-merchant-features';
// Import mocked modules
import { useToast } from '@/hooks/use-toast';
import { getPreviewUrl } from './actions';

describe('BlogClientPage', () => {
  const mockToast = vi.fn();
  const mockMerchant = {
    id: 'merchant-1',
    slug: 'test-merchant',
    custom_domain: null,
  };

  const mockPosts: BlogPost[] = [
    {
      id: 'post-1',
      title: 'First Blog Post',
      slug: 'first-blog-post',
      excerpt: 'This is the first post',
      featured_image_url: 'https://example.com/image1.jpg',
      category: 'Technology',
      status: 'published',
      author_name: 'John Doe',
      view_count: 150,
      reading_time_minutes: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      published_at: '2026-01-10T00:00:00Z',
    },
    {
      id: 'post-2',
      title: 'Draft Post',
      slug: 'draft-post',
      excerpt: 'This is a draft',
      featured_image_url: null,
      category: null,
      status: 'draft',
      author_name: 'Jane Smith',
      view_count: 0,
      reading_time_minutes: 3,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-05T00:00:00Z',
      published_at: null,
    },
  ];

  const mockCounts = {
    total: 10,
    published: 5,
    draft: 3,
    archived: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch with default success response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          posts: [],
          hasMore: false,
          counts: { total: 0, published: 0, draft: 0, archived: 0 },
        }),
      } as Response)
    );

    global.window.open = vi.fn();

    // Mock DOM APIs required by Radix UI components
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = vi.fn(() => false);
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = vi.fn();
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }

    (useToast as ReturnType<typeof vi.fn>).mockReturnValue({
      toast: mockToast,
    });

    (useMerchantFeatures as ReturnType<typeof vi.fn>).mockReturnValue({
      autoBlogEnabled: false,
    });
  });

  describe('Rendering', () => {
    it('renders heading, stats cards, and New Post button', () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      expect(
        screen.getByRole('heading', { name: /blog/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/create and manage blog posts/i)
      ).toBeInTheDocument();

      // Stats cards
      expect(screen.getByText('Total Posts')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // total count
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // published count
      expect(screen.getByText('Drafts')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // draft count

      // New Post button
      const newPostButton = screen.getByRole('link', { name: /new post/i });
      expect(newPostButton).toBeInTheDocument();
      expect(newPostButton).toHaveAttribute('href', '/dashboard/blog/new');
    });

    it('renders initial posts when provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      expect(screen.getByText('Draft Post')).toBeInTheDocument();
      expect(screen.getByText('This is the first post')).toBeInTheDocument();
      expect(screen.getByText('This is a draft')).toBeInTheDocument();
    });

    it('shows loading spinner when no initial posts (fetching)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(<BlogClientPage merchant={mockMerchant} />);

      // Should show loader initially (Loader2 renders as SVG with animate-spin class)
      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });
    });

    it('shows empty state message when no posts exist', async () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={[]}
          initialCounts={{ total: 0, published: 0, draft: 0, archived: 0 }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
      });
    });

    it('shows empty state with "Create Your First Post" when no filters active', async () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={[]}
          initialCounts={{ total: 0, published: 0, draft: 0, archived: 0 }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
      });

      const createButton = screen.getByRole('link', {
        name: /create your first post/i,
      });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveAttribute('href', '/dashboard/blog/new');
    });

    it('shows AI Generator button when autoBlogEnabled is true', () => {
      (useMerchantFeatures as ReturnType<typeof vi.fn>).mockReturnValue({
        autoBlogEnabled: true,
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      const aiButton = screen.getByRole('link', { name: /ai generator/i });
      expect(aiButton).toBeInTheDocument();
      expect(aiButton).toHaveAttribute('href', '/dashboard/blog/ai-generator');
    });

    it('shows RSS Feed link when merchant has valid slug', () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      const rssLink = screen.getByRole('link', { name: /rss feed/i });
      expect(rssLink).toBeInTheDocument();
      expect(rssLink).toHaveAttribute('href', '/api/blog/feed/test-merchant');
      expect(rssLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('Filtering and Search', () => {
    it('clicking status card filters posts and resets page', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: [mockPosts[1]],
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Click on "Drafts" card
      const draftsCard = screen
        .getByText('Drafts')
        .closest('div')?.parentElement;
      expect(draftsCard).toBeInTheDocument();
      if (draftsCard) {
        await user.click(draftsCard);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=draft')
        );
      });
    });

    it('search input updates and triggers fetch', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: [mockPosts[0]],
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search posts/i);
      await user.type(searchInput, 'technology');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=technology')
        );
      });
    });

    it('status filter dropdown is rendered', () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Verify select trigger is rendered
      const selectTrigger = screen.getByRole('combobox');
      expect(selectTrigger).toBeInTheDocument();
    });
  });

  describe('Delete Flow', () => {
    it('shows AlertDialog on delete click and removes post on confirm', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Wait for posts to render
      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown menu for first post - find button with MoreHorizontal icon
      const allButtons = screen.getAllByRole('button');
      const dropdownButton = allButtons.find((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      if (dropdownButton) {
        await user.click(dropdownButton);
      }

      // Click Delete
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteButton);

      // AlertDialog should appear
      expect(screen.getByText('Delete Blog Post')).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to delete this blog post/i)
      ).toBeInTheDocument();

      // Confirm delete
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Post should be optimistically removed
      await waitFor(() => {
        expect(screen.queryByText('First Blog Post')).not.toBeInTheDocument();
      });

      // API should be called
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/merchant/blog/posts/post-1',
        expect.anything()
      );

      const deleteInit = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[1]?.[1];
      const deleteHeaders = new Headers(deleteInit?.headers);
      expect(deleteInit).toEqual(
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
      expect(deleteHeaders.get('x-csrf-token')).toBe('test-csrf-token');

      // Success toast
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Post Deleted',
        })
      );
    });

    it('rollback posts and shows error toast on delete error', async () => {
      const user = userEvent.setup();

      // First call: initial fetch returns posts; second call: delete fails
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for first post
      const allButtons = screen.getAllByRole('button');
      const dropdownButton = allButtons.find((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      if (dropdownButton) {
        await user.click(dropdownButton);
      }

      // Click Delete
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm delete
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      // Wait for error handling
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringContaining('restored'),
            variant: 'destructive',
          })
        );
      });

      // Post should be restored
      expect(screen.getByText('First Blog Post')).toBeInTheDocument();
    });
  });

  describe('Update Status', () => {
    it('publish a draft post updates post in list', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'post-2',
            status: 'published',
            title: 'Draft Post',
          }),
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Draft Post')).toBeInTheDocument();
      });

      // Open dropdown for draft post (second post)
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      const secondMoreButton = moreButtons[1];
      await user.click(secondMoreButton);

      // Click Publish
      const publishButton = screen.getByRole('menuitem', {
        name: /^publish$/i,
      });
      await user.click(publishButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          '/api/merchant/blog/posts/post-2',
          expect.anything()
        );
      });

      const publishInit = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[1]?.[1];
      const publishHeaders = new Headers(publishInit?.headers);
      expect(publishInit).toEqual(
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'published' }),
          credentials: 'include',
        })
      );
      expect(publishHeaders.get('content-type')).toBe('application/json');
      expect(publishHeaders.get('x-csrf-token')).toBe('test-csrf-token');

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Post Published',
        })
      );
    });

    it('shows error toast on update status error', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Draft Post')).toBeInTheDocument();
      });

      // Open dropdown for draft post
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[1]);

      // Click Publish
      const publishButton = screen.getByRole('menuitem', {
        name: /^publish$/i,
      });
      await user.click(publishButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to update blog post.',
            variant: 'destructive',
          })
        );
      });
    });

    it('unpublish a published post changes status to draft', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'post-1',
            status: 'draft',
          }),
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for published post (first post)
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      // Click Unpublish
      const unpublishButton = screen.getByRole('menuitem', {
        name: /unpublish/i,
      });
      await user.click(unpublishButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          '/api/merchant/blog/posts/post-1',
          expect.anything()
        );
      });

      const unpublishInit = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[1]?.[1];
      const unpublishHeaders = new Headers(unpublishInit?.headers);
      expect(unpublishInit).toEqual(
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'draft' }),
          credentials: 'include',
        })
      );
      expect(unpublishHeaders.get('content-type')).toBe('application/json');
      expect(unpublishHeaders.get('x-csrf-token')).toBe('test-csrf-token');

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Post Unpublished',
        })
      );
    });

    it('archive a post changes status to archived', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            posts: mockPosts,
            hasMore: false,
            counts: mockCounts,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'post-1',
            status: 'archived',
          }),
        });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for first post
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      // Click Archive
      const archiveButton = screen.getByRole('menuitem', { name: /archive/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          '/api/merchant/blog/posts/post-1',
          expect.anything()
        );
      });

      const archiveInit = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[1]?.[1];
      const archiveHeaders = new Headers(archiveInit?.headers);
      expect(archiveInit).toEqual(
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'archived' }),
          credentials: 'include',
        })
      );
      expect(archiveHeaders.get('content-type')).toBe('application/json');
      expect(archiveHeaders.get('x-csrf-token')).toBe('test-csrf-token');

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Post Archived',
        })
      );
    });
  });

  describe('Preview', () => {
    it('calls getPreviewUrl and opens in new tab', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      (getPreviewUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        '/api/blog/preview?secret=abc&slug=first-blog-post&merchantSlug=test-merchant'
      );

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for first post
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      // Click Preview
      const previewButton = screen.getByRole('menuitem', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(getPreviewUrl).toHaveBeenCalledWith(
          'test-merchant',
          'first-blog-post'
        );
      });

      expect(window.open).toHaveBeenCalledWith(
        '/api/blog/preview?secret=abc&slug=first-blog-post&merchantSlug=test-merchant',
        '_blank'
      );
    });

    it('shows error toast when merchant slug is missing', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={{ id: 'merchant-1', slug: null }}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      // Click Preview
      const previewButton = screen.getByRole('menuitem', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Merchant slug not found.',
            variant: 'destructive',
          })
        );
      });

      expect(window.open).not.toHaveBeenCalled();
    });

    it('shows error toast on preview URL generation failure', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      (getPreviewUrl as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to generate preview')
      );

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      // Click Preview
      const previewButton = screen.getByRole('menuitem', { name: /preview/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to generate preview link.',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Pagination', () => {
    it('Previous button is disabled on first page', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('Next button is disabled when hasMore is false', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('clicking Next button increments page and fetches', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: true,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Wait for initial fetch with hasMore: true
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).not.toBeDisabled();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=20')
        );
      });
    });

    it('clicking Previous button decrements page and fetches', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: true,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Wait for initial render with hasMore: true
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).not.toBeDisabled();
      });

      // Click Next to go to page 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        const previousButton = screen.getByRole('button', {
          name: /previous/i,
        });
        expect(previousButton).not.toBeDisabled();
      });

      // Click Previous to go back to page 1
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('offset=0')
        );
      });
    });
  });

  describe('Post Card Actions', () => {
    it('post title links to edit page', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      const titleLink = screen.getByRole('link', {
        name: /first blog post/i,
      });
      expect(titleLink).toHaveAttribute('href', '/dashboard/blog/post-1/edit');
    });

    it('View Live link shows for published posts with valid slug', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for published post (first post)
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      const viewLiveLink = screen.getByRole('menuitem', { name: /view live/i });
      expect(viewLiveLink).toHaveAttribute(
        'href',
        '/test-merchant/blog/first-blog-post'
      );
    });

    it('View Live link uses custom domain when available', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          posts: mockPosts,
          hasMore: false,
          counts: mockCounts,
        }),
      });

      const merchantWithDomain = {
        ...mockMerchant,
        custom_domain: 'shop.example.com',
      };

      render(
        <BlogClientPage
          merchant={merchantWithDomain}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      });

      // Open dropdown for published post
      const allButtons = screen.getAllByRole('button');
      const moreButtons = allButtons.filter((btn) =>
        btn.querySelector('[class*="lucide-ellipsis"]')
      );
      await user.click(moreButtons[0]);

      const viewLiveLink = screen.getByRole('menuitem', { name: /view live/i });
      expect(viewLiveLink).toHaveAttribute(
        'href',
        'https://shop.example.com/blog/first-blog-post'
      );
    });
  });

  describe('Stats Calculation', () => {
    it('calculates total views from posts when no initialCounts', () => {
      render(
        <BlogClientPage merchant={mockMerchant} initialPosts={mockPosts} />
      );

      // First post has 150 views, second has 0 = 150 total
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('uses initialCounts when provided', () => {
      render(
        <BlogClientPage
          merchant={mockMerchant}
          initialPosts={mockPosts}
          initialCounts={mockCounts}
        />
      );

      // Verify counts are displayed (using screen.getAllByText since numbers may appear multiple times)
      expect(screen.getByText('Total Posts')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText('Drafts')).toBeInTheDocument();

      // Verify specific counts exist on the page
      const allTens = screen.queryAllByText('10');
      expect(allTens.length).toBeGreaterThan(0);

      const allFives = screen.queryAllByText('5');
      expect(allFives.length).toBeGreaterThan(0);

      const allThrees = screen.queryAllByText('3');
      expect(allThrees.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('shows error toast on fetch failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

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

    it('shows error toast on non-ok response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

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
});
