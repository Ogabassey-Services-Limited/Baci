import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  setupBlogClientPageTests,
  useMerchant,
} from './blog-client-page.test-support';

const selectedMerchant = {
  custom_domain: null,
  id: 'merchant-2',
  slug: 'second-store',
};

describe('BlogClientPage merchant isolation', () => {
  setupBlogClientPageTests();

  it('clears the previous merchant posts before loading the selected merchant', async () => {
    const nextMerchantPosts = [
      { ...mockPosts[0], id: 'merchant-2-post', title: 'Second store post' },
    ];
    vi.mocked(useMerchant).mockReturnValue({
      merchant: mockMerchant,
    } as unknown as ReturnType<typeof useMerchant>);
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        counts: { archived: 0, draft: 0, published: 1, total: 1 },
        hasMore: false,
        posts: nextMerchantPosts,
      }),
      ok: true,
      status: 200,
    } as Response);

    const view = render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    expect(screen.getByText('First Blog Post')).toBeInTheDocument();

    vi.mocked(useMerchant).mockReturnValue({
      merchant: selectedMerchant,
    } as unknown as ReturnType<typeof useMerchant>);
    view.rerender(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(screen.queryByText('First Blog Post')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading posts');
    await waitFor(() =>
      expect(screen.getByText('Second store post')).toBeInTheDocument()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('merchantId=merchant-2')
    );
  });
});
