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

async function openPostMenu(
  user: ReturnType<typeof userEvent.setup>,
  index: number
) {
  const buttons = screen
    .getAllByRole('button')
    .filter((button) => button.querySelector('[class*="lucide-ellipsis"]'));
  await user.click(buttons[index] as HTMLButtonElement);
}

describe('BlogClientPage status updates', () => {
  setupBlogClientPageTests();

  it.each([
    {
      action: 'Publish',
      index: 1,
      postId: 'post-2',
      status: 'published',
      toastTitle: 'Post Published',
    },
    {
      action: 'Unpublish',
      index: 0,
      postId: 'post-1',
      status: 'draft',
      toastTitle: 'Post Unpublished',
    },
    {
      action: 'Archive',
      index: 0,
      postId: 'post-1',
      status: 'archived',
      toastTitle: 'Post Archived',
    },
  ] as const)('sends the scoped CSRF mutation when choosing $action', async ({
    action,
    index,
    postId,
    status,
    toastTitle,
  }) => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(response({ id: postId, status }));

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText(index === 1 ? 'Draft Post' : 'First Blog Post');
    await openPostMenu(user, index);
    await user.click(
      screen.getByRole('menuitem', { name: new RegExp(`^${action}$`, 'i') })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `/api/merchant/blog/posts/${postId}?merchantId=merchant-1`,
        expect.anything()
      );
    });
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(request).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status }),
        credentials: 'include',
      })
    );
    const headers = new Headers(request?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('test-csrf-token');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: toastTitle })
    );
  });

  it('reports an unsuccessful status update without a success toast', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false));

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('Draft Post');
    await openPostMenu(user, 1);
    await user.click(screen.getByRole('menuitem', { name: /^publish$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to update blog post.',
          variant: 'destructive',
        })
      );
    });
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Post Published' })
    );
  });
});
