import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  setupBlogClientPageTests,
} from './blog-client-page.test-support';

describe('BlogClientPage filtering', () => {
  setupBlogClientPageTests();

  it('filters through a status card and resets pagination', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        posts: [mockPosts[1]],
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

    const draftsButton = screen.getByRole('button', { name: /drafts/i });
    expect(draftsButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(draftsButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=draft')
      );
    });
    expect(draftsButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds the search input to the posts request', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        posts: [mockPosts[0]],
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
    await user.type(screen.getByPlaceholderText(/search posts/i), 'technology');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=technology')
      );
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
