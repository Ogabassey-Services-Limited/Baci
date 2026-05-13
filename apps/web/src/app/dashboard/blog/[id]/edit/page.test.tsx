import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch, mockFetchWithCsrf, mockPush, mockToast, mockWindowOpen } =
  vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockFetchWithCsrf: vi.fn(),
    mockPush: vi.fn(),
    mockToast: vi.fn(),
    mockWindowOpen: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'post-1' }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/blog/blog-editor', () => ({
  BlogEditor: ({
    content,
    onChange,
    onImageUpload,
  }: {
    content: string;
    onChange: (content: string) => void;
    onImageUpload: (file: File) => Promise<string>;
  }) => (
    <div>
      <label htmlFor="mock-content">Content editor</label>
      <textarea
        id="mock-content"
        value={content}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() =>
          onImageUpload(
            new File(['inline-bytes'], 'inline.png', { type: 'image/png' })
          )
        }
      >
        Upload inline image
      </button>
    </div>
  ),
}));

vi.mock('@/components/blog/product-embed', () => ({
  ProductGrid: () => <div>Embedded products</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div>Calendar</div>,
}));

vi.mock('@/components/ui/file-uploader', () => ({
  FileUploader: ({
    onFilesSelected,
  }: {
    onFilesSelected: (files: File[]) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onFilesSelected([
          new File(['featured-bytes'], 'featured.png', { type: 'image/png' }),
        ])
      }
    >
      Upload featured image
    </button>
  ),
}));

vi.mock('@/env', () => ({
  getRootDomain: () => 'usebaci.com',
}));

vi.mock('@/hooks/use-blog-auto-save', () => ({
  useBlogAutoSave: () => ({
    clearSavedData: vi.fn(),
    hasSavedData: vi.fn(() => false),
    getSavedData: vi.fn(() => null),
  }),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: {
      id: 'merchant-1',
      business_name: 'Baci Store',
      slug: 'baci-store',
      custom_domain: null,
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/validate-slug', () => ({
  isSafeSlug: () => true,
}));

vi.mock('@/lib/validations/blog', () => ({
  blogPostSchema: {
    safeParse: () => ({ success: true, data: {} }),
  },
  sanitizeBlogPostData: (value: Record<string, unknown>) => value,
}));

vi.mock('@/app/dashboard/blog/actions', () => ({
  getPreviewUrl: vi.fn(),
}));

const { default: EditBlogPostPage } = await import('./page');

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

const existingPost = {
  id: 'post-1',
  title: 'Existing Post',
  slug: 'existing-post',
  content: 'Existing content',
  excerpt: 'Existing excerpt',
  featured_image_url:
    'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/original.png',
  featured_image_alt: 'Existing cover',
  featured_image_width: 1200,
  featured_image_height: 675,
  featured_image_variants: {
    landscape_16x9:
      'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/upload-1/landscape_16x9.webp',
    standard_4x3:
      'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/upload-1/standard_4x3.webp',
  },
  category: 'News',
  tags: ['discover'],
  keywords: ['seo'],
  author_name: 'Baci Store',
  author_title: '',
  author_bio: '',
  seo_title: '',
  seo_description: '',
  focus_keyword: '',
  status: 'draft',
  published_at: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-02T00:00:00.000Z',
  view_count: 0,
  word_count: 2,
  reading_time_minutes: 1,
};

describe('EditBlogPostPage Discover image upload metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue(jsonResponse(existingPost));
  });

  it('hydrates image metadata and persists it on save', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValueOnce(
      jsonResponse({ ...existingPost, updated_at: '2026-05-03T00:00:00.000Z' })
    );

    render(<EditBlogPostPage />);

    await screen.findByRole('heading', { name: /edit post/i });
    expect(screen.getByAltText('Featured image preview')).toHaveAttribute(
      'src',
      existingPost.featured_image_variants.landscape_16x9
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));
    const saveOptions = mockFetchWithCsrf.mock.calls[0]?.[1] as {
      body: string;
    };
    const payload = JSON.parse(saveOptions.body) as Record<string, unknown>;

    expect(payload.featured_image_url).toBe(existingPost.featured_image_url);
    expect(payload.featured_image_width).toBe(1200);
    expect(payload.featured_image_height).toBe(675);
    expect(payload.featured_image_variants).toEqual(
      existingPost.featured_image_variants
    );
  });

  it('uploads editor images with purpose=inline', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValueOnce(
      jsonResponse({ url: 'https://cdn.example.com/inline.png' })
    );

    render(<EditBlogPostPage />);

    await screen.findByRole('heading', { name: /edit post/i });
    await user.click(
      screen.getByRole('button', { name: /upload inline image/i })
    );

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));
    const uploadOptions = mockFetchWithCsrf.mock.calls[0]?.[1] as {
      body: FormData;
    };
    expect(uploadOptions.body.get('purpose')).toBe('inline');
  });
});
