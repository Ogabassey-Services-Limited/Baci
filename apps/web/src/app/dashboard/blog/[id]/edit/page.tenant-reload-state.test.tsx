import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/hooks/use-blog-auto-save', () => ({
  useBlogAutoSave: () => ({
    clearSavedData: vi.fn(),
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
  submitBlogPostUpdate: vi.fn(),
}));
vi.mock('./edit-blog-header', () => ({
  EditBlogHeader: ({
    formData,
    originalPost,
    scheduledDate,
  }: {
    formData: { title: string };
    originalPost: { title: string } | null;
    scheduledDate?: Date;
  }) => (
    <output aria-label="edit-state">
      {formData.title}|{originalPost?.title ?? ''}|
      {scheduledDate?.toISOString() ?? ''}
    </output>
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
  published_at: '2026-08-02T10:00:00.000Z',
  seo_description: '',
  seo_title: '',
  slug: 'post-a',
  status: 'scheduled' as const,
  tags: '',
  title: 'Post A',
};

function setActiveMerchant(id: string) {
  mockMerchant.business_name = id;
  mockMerchant.id = id;
  mockMerchant.slug = id;
}

describe('EditBlogPostPage tenant reload state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveMerchant('merchant-a');
    mockLoadBlogPost
      .mockResolvedValueOnce({
        embeddedProducts: [],
        formData: loadedPost,
        post: { ...loadedPost, id: 'post-1', view_count: 0 },
        productsLoadFailed: false,
        status: 'success',
      })
      .mockResolvedValueOnce({ status: 'error' });
  });

  it('clears Merchant A post state when Merchant B reload fails', async () => {
    const { rerender } = render(<EditBlogPostPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('edit-state')).toHaveTextContent(
        'Post A|Post A|2026-08-02T10:00:00.000Z'
      )
    );

    setActiveMerchant('merchant-b');
    rerender(<EditBlogPostPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('edit-state')).toHaveTextContent('||')
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error', variant: 'destructive' })
    );
  });
});
