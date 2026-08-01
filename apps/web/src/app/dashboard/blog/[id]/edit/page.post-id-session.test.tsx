import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearSavedData,
  mockLoadBlogPost,
  mockMerchant,
  mockPostId,
  mockSubmitBlogPostUpdate,
  mockToast,
} = vi.hoisted(() => ({
  mockClearSavedData: vi.fn(),
  mockLoadBlogPost: vi.fn(),
  mockMerchant: {
    business_name: 'Merchant A',
    custom_domain: null,
    id: 'merchant-a',
    slug: 'merchant-a',
  },
  mockPostId: { current: 'post-1' },
  mockSubmitBlogPostUpdate: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockPostId.current }),
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
vi.mock('./edit-blog-requests', () => ({
  loadBlogPost: (...args: unknown[]) => mockLoadBlogPost(...args),
  submitBlogPostUpdate: (...args: unknown[]) =>
    mockSubmitBlogPostUpdate(...args),
}));
vi.mock('./edit-blog-header', () => ({
  EditBlogHeader: ({
    formData,
    isSaving,
    originalPost,
    savePost,
  }: {
    formData: { status: string; title: string };
    isSaving: boolean;
    originalPost: { title: string } | null;
    savePost: () => Promise<boolean>;
  }) => (
    <>
      <output aria-label="post-state">
        {formData.title}|{formData.status}|{originalPost?.title ?? ''}
      </output>
      <button type="button" disabled={isSaving} onClick={() => void savePost()}>
        Save Changes
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

function createPost(id: string, title: string) {
  return {
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
    id,
    keywords: '',
    published_at: null,
    seo_description: '',
    seo_title: '',
    slug: id,
    status: 'draft' as const,
    tags: '',
    title,
    view_count: 0,
  };
}

type SavedPost = Omit<ReturnType<typeof createPost>, 'status'> & {
  status: 'draft' | 'published';
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

async function renderAndStartSave() {
  const user = userEvent.setup();
  const rendered = render(<EditBlogPostPage />);
  await screen.findByRole('button', { name: 'Save Changes' });
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(mockSubmitBlogPostUpdate).toHaveBeenCalledOnce());
  return rendered;
}

async function navigateToPostTwo(rerender: () => void) {
  mockPostId.current = 'post-2';
  rerender();
  await waitFor(() =>
    expect(screen.getByLabelText('post-state')).toHaveTextContent(
      'Post B|draft|Post B'
    )
  );
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  mockToast.mockClear();
}

describe('EditBlogPostPage post navigation save session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPostId.current = 'post-1';
    mockLoadBlogPost.mockImplementation((postId: string) => {
      const post = createPost(
        postId,
        postId === 'post-1' ? 'Post A' : 'Post B'
      );
      return Promise.resolve({
        embeddedProducts: [],
        formData: post,
        post,
        productsLoadFailed: false,
        status: 'success',
      });
    });
  });

  it('ignores a post-one save success after navigation loads post two', async () => {
    const savedPost = createDeferred<SavedPost>();
    mockSubmitBlogPostUpdate.mockReturnValueOnce(savedPost.promise);
    const { rerender } = await renderAndStartSave();
    await navigateToPostTwo(() => rerender(<EditBlogPostPage />));

    await act(async () => {
      savedPost.resolve({
        ...createPost('post-1', 'Post A'),
        status: 'published',
      });
      await savedPost.promise;
    });

    expect(screen.getByLabelText('post-state')).toHaveTextContent(
      'Post B|draft|Post B'
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockClearSavedData).not.toHaveBeenCalled();
  });

  it('ignores a post-one save failure after navigation loads post two', async () => {
    const savedPost = createDeferred<SavedPost>();
    mockSubmitBlogPostUpdate.mockReturnValueOnce(savedPost.promise);
    const { rerender } = await renderAndStartSave();
    await navigateToPostTwo(() => rerender(<EditBlogPostPage />));

    await act(async () => {
      savedPost.reject(new Error('Save failed'));
      await savedPost.promise.catch(() => undefined);
    });

    expect(screen.getByLabelText('post-state')).toHaveTextContent(
      'Post B|draft|Post B'
    );
    expect(mockToast).not.toHaveBeenCalled();
  });
});
