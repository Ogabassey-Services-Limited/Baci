import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchWithCsrf, mockPush, mockToast, mockWindowOpen } = vi.hoisted(
  () => ({
    mockFetchWithCsrf: vi.fn(),
    mockPush: vi.fn(),
    mockToast: vi.fn(),
    mockWindowOpen: vi.fn(),
  })
);

vi.mock('next/navigation', () => ({
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

vi.mock('@/app/dashboard/blog/actions', () => ({
  getPreviewUrl: vi.fn(),
}));

const { default: NewBlogPostPage } = await import('./page');

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

const featuredUploadResponse = {
  url: 'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/original.png',
  path: 'merchant-1/blog/original.png',
  filename: 'original.png',
  size: 1024,
  type: 'image/png',
  width: 1200,
  height: 675,
  variants: {
    landscape_16x9:
      'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/upload-1/landscape_16x9.webp',
    standard_4x3:
      'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/upload-1/standard_4x3.webp',
  },
  variantPaths: {
    landscape_16x9: 'merchant-1/blog/upload-1/landscape_16x9.webp',
    standard_4x3: 'merchant-1/blog/upload-1/standard_4x3.webp',
  },
};

describe('NewBlogPostPage Discover image upload metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
  });

  it('uploads featured images with purpose=featured and persists returned metadata', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf
      .mockResolvedValueOnce(jsonResponse(featuredUploadResponse))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'post-1', slug: 'discover-ready-post' })
      );

    render(<NewBlogPostPage />);

    await user.type(screen.getByLabelText(/title/i), 'Discover Ready Post');
    await user.type(screen.getByLabelText(/content editor/i), 'Post content');
    await user.click(
      screen.getByRole('button', { name: /upload featured image/i })
    );

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));
    const uploadOptions = mockFetchWithCsrf.mock.calls[0]?.[1] as {
      body: FormData;
    };
    expect(uploadOptions.body.get('purpose')).toBe('featured');

    await waitFor(() =>
      expect(screen.getByAltText('Featured image preview')).toHaveAttribute(
        'src',
        featuredUploadResponse.variants.landscape_16x9
      )
    );

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(2));
    const saveOptions = mockFetchWithCsrf.mock.calls[1]?.[1] as {
      body: string;
    };
    const payload = JSON.parse(saveOptions.body) as Record<string, unknown>;

    expect(payload.featured_image_url).toBe(featuredUploadResponse.url);
    expect(payload.featured_image_width).toBe(1200);
    expect(payload.featured_image_height).toBe(675);
    expect(payload.featured_image_variants).toEqual(
      featuredUploadResponse.variants
    );
  });

  it('uploads editor images with purpose=inline', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValueOnce(
      jsonResponse({ url: 'https://cdn.example.com/inline.png' })
    );

    render(<NewBlogPostPage />);

    await user.click(
      screen.getByRole('button', { name: /upload inline image/i })
    );

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));
    const uploadOptions = mockFetchWithCsrf.mock.calls[0]?.[1] as {
      body: FormData;
    };
    expect(uploadOptions.body.get('purpose')).toBe('inline');
  });

  it('deletes newly uploaded featured-image paths when the image is removed', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf
      .mockResolvedValueOnce(jsonResponse(featuredUploadResponse))
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    render(<NewBlogPostPage />);

    await user.click(
      screen.getByRole('button', { name: /upload featured image/i })
    );
    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /remove image/i }));

    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(2));
    expect(mockFetchWithCsrf.mock.calls[1]?.[0]).toBe(
      '/api/merchant/blog/upload'
    );
    const deleteOptions = mockFetchWithCsrf.mock.calls[1]?.[1] as {
      method: string;
      body: string;
    };
    expect(deleteOptions.method).toBe('DELETE');
    expect(JSON.parse(deleteOptions.body)).toEqual({
      path: featuredUploadResponse.path,
      variantPaths: featuredUploadResponse.variantPaths,
    });

    expect(
      screen.queryByAltText('Featured image preview')
    ).not.toBeInTheDocument();
  });
});
