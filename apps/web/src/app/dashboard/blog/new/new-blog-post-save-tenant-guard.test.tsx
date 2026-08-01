import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearSavedData,
  mockFetchWithCsrf,
  mockGetPreviewUrl,
  mockMerchant,
  mockPush,
  mockToast,
  mockWindowOpen,
} = vi.hoisted(() => ({
  mockClearSavedData: vi.fn(),
  mockFetchWithCsrf: vi.fn(),
  mockGetPreviewUrl: vi.fn(),
  mockMerchant: {
    business_name: 'Merchant A',
    id: 'merchant-a',
    slug: 'merchant-a',
  },
  mockPush: vi.fn(),
  mockToast: vi.fn(),
  mockWindowOpen: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsList: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-blog-auto-save', () => ({
  useBlogAutoSave: () => ({
    clearSavedData: mockClearSavedData,
    getSavedData: () => null,
    hasSavedData: () => false,
  }),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: mockMerchant }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/app/dashboard/blog/actions', () => ({
  getPreviewUrl: (...args: unknown[]) => mockGetPreviewUrl(...args),
}));

vi.mock('./new-blog-post-header', () => ({
  NewBlogPostHeader: ({
    isSaving,
    onPreview,
    onPublish,
    onSaveDraft,
  }: {
    isSaving: boolean;
    onPreview: () => void;
    onPublish: () => void;
    onSaveDraft: () => void;
  }) => (
    <>
      <button type="button" disabled={isSaving} onClick={onPreview}>
        Preview
      </button>
      <button type="button" disabled={isSaving} onClick={onSaveDraft}>
        Save draft
      </button>
      <button type="button" disabled={isSaving} onClick={onPublish}>
        Publish
      </button>
    </>
  ),
}));

vi.mock('./new-blog-post-content-tab', () => ({
  NewBlogPostContentTab: ({
    handleChange,
    handleTitleChange,
  }: {
    handleChange: (field: 'content', value: string) => void;
    handleTitleChange: (title: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        handleTitleChange('Merchant post');
        handleChange('content', 'Post content');
      }}
    >
      Fill post
    </button>
  ),
}));

vi.mock('./new-blog-post-seo-tab', () => ({ NewBlogPostSeoTab: () => null }));
vi.mock('./new-blog-post-author-tab', () => ({
  NewBlogPostAuthorTab: () => null,
}));
vi.mock('./new-blog-post-recovery-dialog', () => ({
  NewBlogPostRecoveryDialog: () => null,
}));
vi.mock('./use-new-blog-post-media-actions', () => ({
  useNewBlogPostMediaActions: () => ({
    handleFeaturedImageUpload: vi.fn(),
    handleImageUpload: vi.fn(),
    handleRemoveFeaturedImage: vi.fn(),
    isUploading: false,
  }),
}));

const { default: NewBlogPostPage } = await import('./page');

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function jsonResponse(body: unknown) {
  return { json: async () => body, ok: true };
}

function setActiveMerchant(id: string, businessName: string) {
  mockMerchant.business_name = businessName;
  mockMerchant.id = id;
  mockMerchant.slug = id;
}

describe('NewBlogPostPage tenant-scoped save completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveMerchant('merchant-a', 'Merchant A');
    window.open = mockWindowOpen;
  });

  it('does not update a new Merchant A session after the prior A save resolves late', async () => {
    const user = userEvent.setup();
    const savedPost = createDeferred<ReturnType<typeof jsonResponse>>();
    mockFetchWithCsrf.mockReturnValueOnce(savedPost.promise);

    const { rerender } = render(<NewBlogPostPage />);
    await user.click(screen.getByRole('button', { name: 'Fill post' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledOnce());

    setActiveMerchant('merchant-b', 'Merchant B');
    rerender(<NewBlogPostPage />);
    setActiveMerchant('merchant-a', 'Merchant A again');
    rerender(<NewBlogPostPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    );

    await act(async () => {
      savedPost.resolve(
        jsonResponse({ id: 'post-a', slug: 'merchant-a-post' })
      );
      await savedPost.promise;
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockClearSavedData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not show Merchant A save errors after switching to Merchant B', async () => {
    const user = userEvent.setup();
    const failedPost = createDeferred<ReturnType<typeof jsonResponse>>();
    mockFetchWithCsrf.mockReturnValueOnce(failedPost.promise);

    const { rerender } = render(<NewBlogPostPage />);
    await user.click(screen.getByRole('button', { name: 'Fill post' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledOnce());

    setActiveMerchant('merchant-b', 'Merchant B');
    rerender(<NewBlogPostPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    );

    await act(async () => {
      failedPost.reject(new Error('Merchant A request failed'));
      await failedPost.promise.catch(() => undefined);
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockClearSavedData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not open or redirect a new Merchant A session after an earlier A preview resolves late', async () => {
    const user = userEvent.setup();
    const previewUrl = createDeferred<string>();
    mockFetchWithCsrf.mockResolvedValueOnce(
      jsonResponse({ id: 'post-a', slug: 'merchant-a-post' })
    );
    mockGetPreviewUrl.mockReturnValueOnce(previewUrl.promise);

    const { rerender } = render(<NewBlogPostPage />);
    await user.click(screen.getByRole('button', { name: 'Fill post' }));
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(mockGetPreviewUrl).toHaveBeenCalledWith(
        'merchant-a',
        'merchant-a-post'
      )
    );

    setActiveMerchant('merchant-b', 'Merchant B');
    rerender(<NewBlogPostPage />);
    setActiveMerchant('merchant-a', 'Merchant A again');
    rerender(<NewBlogPostPage />);
    mockPush.mockClear();
    mockToast.mockClear();
    mockWindowOpen.mockClear();

    await act(async () => {
      previewUrl.resolve('https://merchant-a.example.com/preview');
      await previewUrl.promise;
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not show Merchant A preview errors after switching to Merchant B', async () => {
    const user = userEvent.setup();
    const previewUrl = createDeferred<string>();
    mockFetchWithCsrf.mockResolvedValueOnce(
      jsonResponse({ id: 'post-a', slug: 'merchant-a-post' })
    );
    mockGetPreviewUrl.mockReturnValueOnce(previewUrl.promise);

    const { rerender } = render(<NewBlogPostPage />);
    await user.click(screen.getByRole('button', { name: 'Fill post' }));
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(mockGetPreviewUrl).toHaveBeenCalledOnce());

    setActiveMerchant('merchant-b', 'Merchant B');
    rerender(<NewBlogPostPage />);
    mockPush.mockClear();
    mockToast.mockClear();
    mockWindowOpen.mockClear();

    await act(async () => {
      previewUrl.reject(new Error('Merchant A preview failed'));
      await previewUrl.promise.catch(() => undefined);
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
