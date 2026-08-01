import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_FORM_DATA } from './edit-blog-form-data';

const { mockLoadBlogPost, mockMerchant, mockToast } = vi.hoisted(() => ({
  mockLoadBlogPost: vi.fn(),
  mockMerchant: {
    business_name: 'Merchant A',
    custom_domain: null,
    id: 'merchant-a',
    slug: 'merchant-a',
  },
  mockToast: vi.fn(),
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
  submitBlogPostUpdate: vi.fn(),
}));
vi.mock('./edit-blog-header', () => ({
  EditBlogHeader: ({ formData }: { formData: { title: string } }) => (
    <output aria-label="post-title">{formData.title}</output>
  ),
}));
vi.mock('./edit-blog-content-tab', () => ({ EditBlogContentTab: () => null }));
vi.mock('./edit-blog-seo-tab', () => ({ EditBlogSeoTab: () => null }));
vi.mock('./edit-blog-author-tab', () => ({ EditBlogAuthorTab: () => null }));
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
  ...INITIAL_FORM_DATA,
  id: 'post-1',
  published_at: null,
  title: 'Saved Post A',
  view_count: 0,
};

function setActiveMerchant(id: string) {
  mockMerchant.business_name = id;
  mockMerchant.id = id;
  mockMerchant.slug = id;
}

function saveDraft(key: string, title: string) {
  localStorage.setItem(
    key,
    JSON.stringify({
      data: { ...INITIAL_FORM_DATA, title },
      savedAt: new Date().toISOString(),
    })
  );
}

describe('EditBlogPostPage tenant draft recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActiveMerchant('merchant-a');
    mockLoadBlogPost
      .mockResolvedValueOnce({
        embeddedProducts: [],
        formData: loadedPost,
        post: loadedPost,
        productsLoadFailed: false,
        status: 'success',
      })
      .mockResolvedValueOnce({ status: 'error' });
  });

  it('does not restore Merchant A local storage into Merchant B after its reload fails', async () => {
    saveDraft('blog-draft-edit-merchant-a-post-1', 'Merchant A draft');
    saveDraft('blog-draft-edit-post-1', 'Unsafe legacy draft');
    const { rerender } = render(<EditBlogPostPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('post-title')).toHaveTextContent(
        'Merchant A draft'
      )
    );

    setActiveMerchant('merchant-b');
    rerender(<EditBlogPostPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('post-title')).toHaveTextContent('')
    );
  });
});
