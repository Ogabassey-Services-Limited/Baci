import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewBlogPostMediaActions } from './use-new-blog-post-media-actions';

const { mockFetchWithCsrf, mockMerchant } = vi.hoisted(() => ({
  mockFetchWithCsrf: vi.fn(),
  mockMerchant: { id: 'merchant-selected' },
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: mockMerchant }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

const image = {
  path: 'merchant-selected/blog/featured.png',
  variantPaths: {
    landscape_16x9: 'merchant-selected/blog/featured/landscape_16x9.webp',
  },
};

function response(body: unknown) {
  return { ok: true, json: async () => body };
}

function renderMediaActions() {
  return renderHook(() =>
    useNewBlogPostMediaActions({
      uploadedFeaturedImage: null,
      setFormData: vi.fn(),
      setUploadedFeaturedImage: vi.fn(),
      toast: vi.fn(),
    })
  );
}

describe('useNewBlogPostMediaActions merchant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant.id = 'merchant-selected';
  });

  it('sends the selected merchant context with inline media uploads', async () => {
    mockFetchWithCsrf.mockResolvedValueOnce(
      response({ url: 'https://cdn.example.com/inline.png' })
    );
    const { result } = renderMediaActions();

    await act(() =>
      result.current.handleImageUpload(
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

  it('sends the selected merchant context when deleting an uploaded featured image', async () => {
    mockFetchWithCsrf.mockResolvedValueOnce(response({ success: true }));
    const { result } = renderHook(() =>
      useNewBlogPostMediaActions({
        uploadedFeaturedImage: image,
        setFormData: vi.fn(),
        setUploadedFeaturedImage: vi.fn(),
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
