import type { ReactNode } from 'react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockFetchWithCsrf: vi.fn(),
  mockPush: vi.fn(),
  mockToast: vi.fn(),
  mockWindowOpen: vi.fn(),
  mockFeaturedImageUploader: {
    onFilesSelected: undefined as
      | ((files: File[]) => void | Promise<void>)
      | undefined,
  },
}));

export const mockFetch = mocks.mockFetch;
export const mockFetchWithCsrf = mocks.mockFetchWithCsrf;
export const mockPush = mocks.mockPush;
export const mockToast = mocks.mockToast;
export const mockWindowOpen = mocks.mockWindowOpen;
export const mockFeaturedImageUploader = mocks.mockFeaturedImageUploader;

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'post-1' }),
  useRouter: () => ({ push: mockPush }),
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
vi.mock('@/components/blog/product-embed-grid', () => ({
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
  }) => {
    mockFeaturedImageUploader.onFilesSelected = onFilesSelected;
    return (
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
    );
  },
}));
vi.mock('@/env', () => ({ getRootDomain: () => 'usebaci.com' }));
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
  useToast: () => ({ toast: mockToast }),
}));
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));
vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));
vi.mock('@/lib/validate-slug', () => ({ isSafeSlug: () => true }));
vi.mock('@/lib/validations/blog', () => ({
  blogPostSchema: { safeParse: () => ({ success: true, data: {} }) },
  sanitizeBlogPostData: (value: Record<string, unknown>) => value,
}));
vi.mock('@/app/dashboard/blog/actions', () => ({ getPreviewUrl: vi.fn() }));

export const { default: EditBlogPostPage } = await import('./page');
export function jsonResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number }
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

export const existingPost = {
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
