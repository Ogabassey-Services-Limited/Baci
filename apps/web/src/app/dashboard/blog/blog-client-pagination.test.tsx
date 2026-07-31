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

function configurePageResponse(hasMore: boolean) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ posts: mockPosts, hasMore, counts: mockCounts }),
  } as Response);
}

describe('BlogClientPage pagination', () => {
  setupBlogClientPageTests();

  it('disables Previous on page one and Next when there are no more posts', async () => {
    configurePageResponse(false);
    render(
      <BlogClientPage
        initialCounts={{ ...mockCounts, total: mockPosts.length }}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('requests the next and previous offsets as the page changes', async () => {
    const user = userEvent.setup();
    configurePageResponse(true);
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    const next = await screen.findByRole('button', { name: /next/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'));
    });

    const previous = screen.getByRole('button', { name: /previous/i });
    await waitFor(() => expect(previous).toBeEnabled());
    await user.click(previous);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=0'));
    });
  });
});
