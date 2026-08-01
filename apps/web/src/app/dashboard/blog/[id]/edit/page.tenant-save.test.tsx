import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearSavedData,
  mockLoadBlogPost,
  mockMerchant,
  mockPush,
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
  mockPush: vi.fn(),
  mockSubmitBlogPostUpdate: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'post-1' }),
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

vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));
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
    savePost,
  }: {
    formData: { status: string };
    isSaving: boolean;
    savePost: () => Promise<boolean>;
  }) => (
    <>
      <h1>Edit Post</h1>
      <output aria-label="post-status">{formData.status}</output>
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
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function setActiveMerchant(id: string, businessName: string) {
  mockMerchant.business_name = businessName;
  mockMerchant.id = id;
  mockMerchant.slug = id;
}

describe('EditBlogPostPage tenant-scoped save completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveMerchant('merchant-a', 'Merchant A');
    mockLoadBlogPost.mockResolvedValue({
      embeddedProducts: [],
      formData: loadedPost,
      post: { ...loadedPost, id: 'post-1', view_count: 0 },
      productsLoadFailed: false,
      status: 'success',
    });
  });

  it('does not update a new Merchant A session when an earlier A save resolves late', async () => {
    const user = userEvent.setup();
    const savedPost = createDeferred<typeof loadedPost>();
    mockSubmitBlogPostUpdate.mockReturnValueOnce(savedPost.promise);

    const { rerender } = render(<EditBlogPostPage />);
    await screen.findByRole('heading', { name: 'Edit Post' });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(mockSubmitBlogPostUpdate).toHaveBeenCalledOnce()
    );

    setActiveMerchant('merchant-b', 'Merchant B');
    rerender(<EditBlogPostPage />);
    setActiveMerchant('merchant-a', 'Merchant A again');
    rerender(<EditBlogPostPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    );

    await act(async () => {
      savedPost.resolve({ ...loadedPost, status: 'published' });
      await savedPost.promise;
    });

    expect(screen.getByLabelText('post-status')).toHaveTextContent('draft');
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockClearSavedData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
