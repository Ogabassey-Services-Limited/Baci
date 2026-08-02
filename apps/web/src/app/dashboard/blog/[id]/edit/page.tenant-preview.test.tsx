import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearSavedData,
  mockGetPreviewUrl,
  mockLoadBlogPost,
  mockMerchant,
  mockSubmitBlogPostUpdate,
  mockToast,
  mockWindowOpen,
} = vi.hoisted(() => ({
  mockClearSavedData: vi.fn(),
  mockGetPreviewUrl: vi.fn(),
  mockLoadBlogPost: vi.fn(),
  mockMerchant: {
    business_name: 'Merchant A',
    custom_domain: null,
    id: 'merchant-a',
    slug: 'merchant-a',
  },
  mockSubmitBlogPostUpdate: vi.fn(),
  mockToast: vi.fn(),
  mockWindowOpen: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'post-1' }),
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock('@/lib/validations/blog', () => ({
  blogPostSchema: { safeParse: () => ({ data: {}, success: true }) },
  sanitizeBlogPostData: (value: Record<string, unknown>) => value,
}));
vi.mock('@/app/dashboard/blog/actions', () => ({
  getPreviewUrl: (...args: unknown[]) => mockGetPreviewUrl(...args),
}));
vi.mock('./edit-blog-requests', () => ({
  loadBlogPost: (...args: unknown[]) => mockLoadBlogPost(...args),
  submitBlogPostUpdate: (...args: unknown[]) =>
    mockSubmitBlogPostUpdate(...args),
}));
vi.mock('./edit-blog-header', () => ({
  EditBlogHeader: ({
    isSaving,
    onPreview,
  }: {
    isSaving: boolean;
    onPreview: () => Promise<void>;
  }) => (
    <>
      <h1>Edit Post</h1>
      <button
        type="button"
        disabled={isSaving}
        onClick={() => void onPreview()}
      >
        Preview
      </button>
    </>
  ),
}));
vi.mock('./edit-blog-content-tab', () => ({ EditBlogContentTab: () => null }));
vi.mock('./edit-blog-seo-tab', () => ({ EditBlogSeoTab: () => null }));
vi.mock('./edit-blog-author-tab', () => ({ EditBlogAuthorTab: () => null }));
vi.mock('./use-edit-blog-draft-recovery', () => ({
  useEditBlogDraftRecovery: () => vi.fn(),
}));
vi.mock('./use-featured-image-actions', () => ({
  useFeaturedImageActions: () => ({
    handleFeaturedImageUpload: vi.fn(),
    handleInlineImageUpload: vi.fn(),
    handleRemoveFeaturedImage: vi.fn(),
    isUploading: false,
  }),
}));

const { default: EditBlogPostPage } = await import('./page');

const loadedPost = {
  author_bio: '',
  author_name: 'Merchant A',
  author_title: '',
  category: '',
  content: 'Post content',
  excerpt: '',
  featured_image_alt: '',
  featured_image_height: null,
  featured_image_url: '',
  featured_image_variants: {},
  featured_image_width: null,
  focus_keyword: '',
  keywords: '',
  published_at: null,
  seo_description: '',
  seo_title: '',
  slug: 'post-a',
  status: 'draft',
  tags: '',
  title: 'Post A',
};

function createDeferred<T>() {
  let reject: (reason?: unknown) => void = () => undefined;
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function setActiveMerchant(id: string) {
  mockMerchant.business_name = id;
  mockMerchant.id = id;
  mockMerchant.slug = id;
}

describe('EditBlogPostPage tenant-scoped preview completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveMerchant('merchant-a');
    window.open = mockWindowOpen;
    mockLoadBlogPost.mockResolvedValue({
      embeddedProducts: [],
      formData: loadedPost,
      post: { ...loadedPost, id: 'post-1', view_count: 0 },
      productsLoadFailed: false,
      status: 'success',
    });
    mockSubmitBlogPostUpdate.mockResolvedValue(loadedPost);
  });

  it('does not open a stale preview after Merchant A switches to B and back to A', async () => {
    const user = userEvent.setup();
    const previewUrl = createDeferred<string>();
    mockGetPreviewUrl.mockReturnValueOnce(previewUrl.promise);
    const { rerender } = render(<EditBlogPostPage />);
    await screen.findByRole('heading', { name: 'Edit Post' });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(mockGetPreviewUrl).toHaveBeenCalledOnce());

    setActiveMerchant('merchant-b');
    rerender(<EditBlogPostPage />);
    setActiveMerchant('merchant-a');
    rerender(<EditBlogPostPage />);
    mockToast.mockClear();
    mockWindowOpen.mockClear();
    await act(async () => {
      previewUrl.resolve('https://merchant-a.example.com/preview');
      await previewUrl.promise;
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not show a stale preview error after Merchant A switches to B', async () => {
    const user = userEvent.setup();
    const previewUrl = createDeferred<string>();
    mockGetPreviewUrl.mockReturnValueOnce(previewUrl.promise);
    const { rerender } = render(<EditBlogPostPage />);
    await screen.findByRole('heading', { name: 'Edit Post' });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(mockGetPreviewUrl).toHaveBeenCalledOnce());

    setActiveMerchant('merchant-b');
    rerender(<EditBlogPostPage />);
    mockToast.mockClear();
    mockWindowOpen.mockClear();
    await act(async () => {
      previewUrl.reject(new Error('Preview failed'));
      await previewUrl.promise.catch(() => undefined);
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
