import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newBlogPostMediaUtils } from './new-blog-post-media-utils';

const { fetchWithCsrf } = vi.hoisted(() => ({ fetchWithCsrf: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf }));

describe('newBlogPostMediaUtils', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses required image metadata and drops unknown variants', () => {
    expect(
      newBlogPostMediaUtils.parseFeaturedImageUploadResponse({
        height: 675,
        path: 'merchant-1/blog/cover.png',
        url: 'https://cdn.example.com/cover.png',
        variantPaths: {
          landscape_16x9: 'merchant-1/blog/upload-1/landscape_16x9.webp',
          unknown: 'merchant-1/blog/upload-1/unknown.webp',
        },
        variants: {
          landscape_16x9: 'https://cdn.example.com/landscape.webp',
          unknown: 'https://cdn.example.com/unknown.webp',
        },
        width: 1200,
      })
    ).toEqual({
      height: 675,
      path: 'merchant-1/blog/cover.png',
      url: 'https://cdn.example.com/cover.png',
      variantPaths: {
        landscape_16x9: 'merchant-1/blog/upload-1/landscape_16x9.webp',
      },
      variants: {
        landscape_16x9: 'https://cdn.example.com/landscape.webp',
      },
      width: 1200,
    });
  });

  it('rejects image uploads without positive dimensions', () => {
    expect(() =>
      newBlogPostMediaUtils.parseFeaturedImageUploadResponse({
        height: 0,
        path: 'merchant-1/blog/cover.png',
        url: 'https://cdn.example.com/cover.png',
        width: 1200,
      })
    ).toThrow('valid image dimensions');
  });

  it('deletes every tracked variant within the selected merchant context', async () => {
    fetchWithCsrf.mockResolvedValue({ json: async () => ({}), ok: true });

    await newBlogPostMediaUtils.deleteUploadedFeaturedImage(
      {
        path: 'merchant-1/blog/cover.png',
        variantPaths: {
          landscape_16x9: 'merchant-1/blog/upload-1/landscape_16x9.webp',
        },
      },
      'merchant-1'
    );

    expect(fetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/upload',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-baci-merchant-id': 'merchant-1',
        }),
        method: 'DELETE',
      })
    );
    expect(JSON.parse(fetchWithCsrf.mock.calls[0]?.[1].body as string)).toEqual(
      {
        path: 'merchant-1/blog/cover.png',
        variantPaths: {
          landscape_16x9: 'merchant-1/blog/upload-1/landscape_16x9.webp',
        },
      }
    );
  });

  it('surfaces the server deletion error', async () => {
    fetchWithCsrf.mockResolvedValue({
      json: async () => ({ error: 'Image is still referenced' }),
      ok: false,
    });

    await expect(
      newBlogPostMediaUtils.deleteUploadedFeaturedImage(
        { path: 'merchant-1/blog/cover.png', variantPaths: {} },
        'merchant-1'
      )
    ).rejects.toThrow('Image is still referenced');
  });
});
