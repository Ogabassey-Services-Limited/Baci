import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostFormData } from './edit-blog-types';
import { useFeaturedImageActions } from './use-featured-image-actions';

const mockFetchWithCsrf = vi.fn();

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

const formData: PostFormData = {
  title: '',
  slug: '',
  content: '',
  excerpt: '',
  featured_image_url: '',
  featured_image_alt: '',
  featured_image_width: null,
  featured_image_height: null,
  featured_image_variants: {},
  category: '',
  tags: '',
  keywords: '',
  author_name: '',
  author_title: '',
  author_bio: '',
  seo_title: '',
  seo_description: '',
  focus_keyword: '',
  status: 'draft',
  published_at: null,
};

function response(body: unknown) {
  return { ok: true, json: async () => body };
}

describe('useFeaturedImageActions merchant context', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the selected merchant context with inline image uploads', async () => {
    mockFetchWithCsrf.mockResolvedValueOnce(
      response({ url: 'https://cdn.example.com/inline.png' })
    );
    const { result } = renderHook(() =>
      useFeaturedImageActions({
        merchantId: 'merchant-selected',
        formData,
        setFormData: vi.fn(),
        toast: vi.fn(),
      })
    );

    await act(() =>
      result.current.handleInlineImageUpload(
        new File(['image'], 'inline.png', { type: 'image/png' })
      )
    );

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/upload',
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': 'merchant-selected' },
        method: 'POST',
      })
    );
  });

  it('sends the selected merchant context when deleting a persisted featured image', async () => {
    mockFetchWithCsrf.mockResolvedValueOnce(response({ success: true }));
    const { result } = renderHook(() =>
      useFeaturedImageActions({
        merchantId: 'merchant-selected',
        formData: {
          ...formData,
          featured_image_url:
            'https://cdn.example.com/media/merchant-selected/blog/featured.png',
        },
        setFormData: vi.fn(),
        toast: vi.fn(),
      })
    );

    await act(() => result.current.handleRemoveFeaturedImage());

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/upload',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-baci-merchant-id': 'merchant-selected',
        }),
        method: 'DELETE',
      })
    );
  });
});
