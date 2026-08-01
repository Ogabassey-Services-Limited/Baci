import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  mockToast,
  setupBlogClientPageTests,
} from './blog-client-page.test-support';

function response(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

async function openFirstDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  const dropdownButton = screen
    .getAllByRole('button')
    .find((button) => button.querySelector('[class*="lucide-ellipsis"]'));
  expect(dropdownButton).toBeDefined();
  await user.click(dropdownButton as HTMLButtonElement);
  await user.click(screen.getByRole('menuitem', { name: /delete/i }));
}

describe('BlogClientPage delete flow', () => {
  setupBlogClientPageTests();

  it('optimistically removes a confirmed post and sends a CSRF request', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(response({}));

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await openFirstDeleteDialog(user);

    expect(screen.getByText('Delete Blog Post')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.queryByText('First Blog Post')).not.toBeInTheDocument();
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/merchant/blog/posts/post-1?merchantId=merchant-1',
      expect.anything()
    );
    const deleteInit = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(deleteInit).toEqual(
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
    expect(new Headers(deleteInit?.headers).get('x-csrf-token')).toBe(
      'test-csrf-token'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Post Deleted' })
    );
  });

  it('restores the post and reports an unsuccessful delete', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false));

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await openFirstDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: expect.stringContaining('restored'),
          variant: 'destructive',
        })
      );
    });
    expect(screen.getByText('First Blog Post')).toBeInTheDocument();
  });
});
