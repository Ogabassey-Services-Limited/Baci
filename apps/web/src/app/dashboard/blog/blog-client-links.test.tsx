import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  setupBlogClientPageTests,
} from './blog-client-page.test-support';

async function openFirstPostMenu(user: ReturnType<typeof userEvent.setup>) {
  const menu = screen
    .getAllByRole('button')
    .find((button) => button.querySelector('[class*="lucide-ellipsis"]'));
  await user.click(menu as HTMLButtonElement);
}

function keepPostsLoaded() {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      posts: mockPosts,
      hasMore: false,
      counts: mockCounts,
    }),
  } as Response);
}

describe('BlogClientPage post links', () => {
  setupBlogClientPageTests();

  it('links the post title to its editor', async () => {
    keepPostsLoaded();
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    expect(
      await screen.findByRole('link', { name: /first blog post/i })
    ).toHaveAttribute('href', '/dashboard/blog/post-1/edit');
  });

  it.each([
    [mockMerchant, '/test-merchant/blog/first-blog-post'],
    [
      { ...mockMerchant, custom_domain: 'shop.example.com' },
      'https://shop.example.com/blog/first-blog-post',
    ],
  ])('uses the correct live URL for the merchant', async (merchant, href) => {
    const user = userEvent.setup();
    keepPostsLoaded();
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={merchant}
      />
    );
    await screen.findByText('First Blog Post');
    await openFirstPostMenu(user);

    expect(
      screen.getByRole('menuitem', { name: /view live/i })
    ).toHaveAttribute('href', href);
  });
});
