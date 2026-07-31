import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAutoSave, mockMerchant, mockToast, savedDrafts } = vi.hoisted(
  () => ({
    mockAutoSave: vi.fn(),
    mockMerchant: {
      business_name: 'Merchant One',
      id: 'merchant-1',
      slug: 'merchant-one',
    },
    mockToast: vi.fn(),
    savedDrafts: new Map<string, { data: { title: string }; savedAt: Date }>(),
  })
);

vi.mock('@/hooks/use-blog-auto-save', () => ({
  useBlogAutoSave: (options: { storageKey: string }) => {
    mockAutoSave(options);
    return {
      clearSavedData: () => savedDrafts.delete(options.storageKey),
      hasSavedData: () => savedDrafts.has(options.storageKey),
      getSavedData: () => savedDrafts.get(options.storageKey) ?? null,
    };
  },
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: mockMerchant }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsList: ({ children }: { children: ReactNode }) => <>{children}</>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./new-blog-post-header', () => ({
  NewBlogPostHeader: () => null,
}));

vi.mock('./new-blog-post-content-tab', () => ({
  NewBlogPostContentTab: ({ formData }: { formData: { title: string } }) => (
    <output>{formData.title}</output>
  ),
}));

vi.mock('./new-blog-post-seo-tab', () => ({
  NewBlogPostSeoTab: () => null,
}));

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

describe('NewBlogPostPage tenant draft recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedDrafts.clear();
    mockMerchant.business_name = 'Merchant One';
    mockMerchant.id = 'merchant-1';
    mockMerchant.slug = 'merchant-one';
  });

  it('recovers only the selected merchant draft after a merchant switch', async () => {
    savedDrafts.set('blog-draft-new-merchant-1', {
      data: { title: 'Merchant One Draft' },
      savedAt: new Date(),
    });
    savedDrafts.set('blog-draft-new-merchant-2', {
      data: { title: 'Merchant Two Draft' },
      savedAt: new Date(),
    });

    const { rerender } = render(<NewBlogPostPage />);

    await screen.findByText('Merchant One Draft');
    expect(mockAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'blog-draft-new-merchant-1' })
    );

    mockMerchant.business_name = 'Merchant Two';
    mockMerchant.id = 'merchant-2';
    mockMerchant.slug = 'merchant-two';
    rerender(<NewBlogPostPage />);

    await waitFor(() =>
      expect(screen.getByText('Merchant Two Draft')).toBeInTheDocument()
    );
    expect(mockAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'blog-draft-new-merchant-2' })
    );
    expect(screen.queryByText('Merchant One Draft')).not.toBeInTheDocument();
  });
});
