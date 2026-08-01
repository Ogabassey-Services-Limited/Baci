import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  getPreviewUrl,
  mockCounts,
  mockMerchant,
  mockPosts,
  mockToast,
  setupBlogClientPageTests,
} from './blog-client-page.test-support';

async function clickFirstPreview(user: ReturnType<typeof userEvent.setup>) {
  const menu = screen
    .getAllByRole('button')
    .find((button) => button.querySelector('[class*="lucide-ellipsis"]'));
  await user.click(menu as HTMLButtonElement);
  await user.click(screen.getByRole('menuitem', { name: /preview/i }));
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

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('BlogClientPage preview', () => {
  setupBlogClientPageTests();

  it('opens the generated preview URL in a new tab', async () => {
    const user = userEvent.setup();
    keepPostsLoaded();
    vi.mocked(getPreviewUrl).mockResolvedValue(
      '/api/blog/preview?secret=abc&slug=first-blog-post&merchantSlug=test-merchant'
    );
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await clickFirstPreview(user);

    await waitFor(() => {
      expect(getPreviewUrl).toHaveBeenCalledWith(
        'merchant-1',
        'test-merchant',
        'first-blog-post'
      );
    });
    expect(window.open).toHaveBeenCalledWith(
      '/api/blog/preview?secret=abc&slug=first-blog-post&merchantSlug=test-merchant',
      '_blank'
    );
  });

  it('does not open a preview after the selected merchant changes', async () => {
    const user = userEvent.setup();
    const preview = createDeferred<string>();
    keepPostsLoaded();
    vi.mocked(getPreviewUrl).mockReturnValue(preview.promise);
    const { rerender } = render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await clickFirstPreview(user);
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledOnce());

    rerender(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={{ ...mockMerchant, id: 'merchant-2', slug: 'other-store' }}
      />
    );
    mockToast.mockClear();

    preview.resolve('/api/blog/preview?secret=abc');
    await preview.promise;

    expect(window.open).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not show a preview error after the selected merchant changes', async () => {
    const user = userEvent.setup();
    const preview = createDeferred<string>();
    keepPostsLoaded();
    vi.mocked(getPreviewUrl).mockReturnValue(preview.promise);
    const { rerender } = render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await clickFirstPreview(user);
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledOnce());

    rerender(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={{ ...mockMerchant, id: 'merchant-2', slug: 'other-store' }}
      />
    );
    mockToast.mockClear();

    preview.reject(new Error('Merchant A preview failed'));
    await preview.promise.catch(() => undefined);

    expect(window.open).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('reports a missing merchant slug without requesting a preview', async () => {
    const user = userEvent.setup();
    keepPostsLoaded();
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={{ id: 'merchant-1', slug: null }}
      />
    );
    await screen.findByText('First Blog Post');
    await clickFirstPreview(user);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Merchant slug not found.',
          variant: 'destructive',
        })
      );
    });
    expect(getPreviewUrl).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('reports preview URL generation failures', async () => {
    const user = userEvent.setup();
    keepPostsLoaded();
    vi.mocked(getPreviewUrl).mockRejectedValue(
      new Error('Failed to generate preview')
    );
    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );
    await screen.findByText('First Blog Post');
    await clickFirstPreview(user);

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
