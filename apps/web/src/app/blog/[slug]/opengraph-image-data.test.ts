import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPlatformBlogPost, mockFetch } = vi.hoisted(() => ({
  mockGetPlatformBlogPost: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN: 'https://usebaci.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  },
}));

vi.mock('@/lib/platform-blog', () => ({
  PLATFORM_BLOG_CONTEXT: {
    baseUrl: 'https://usebaci.com',
    businessName: 'Baci',
    logoUrl: 'https://usebaci.com/logo.png',
  },
  getPlatformBlogPost: (...args: unknown[]) => mockGetPlatformBlogPost(...args),
}));

import { getPlatformBlogOgImageData } from './opengraph-image-data';

function imageResponse(contentType = 'image/jpeg', body = 'image-bytes') {
  return new Response(body, {
    headers: contentType ? { 'content-type': contentType } : undefined,
    status: 200,
  });
}

describe('platform blog OG image data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(imageResponse('image/png', 'logo'));
  });

  it('returns branded fallback data when the post is missing', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce(null);

    await expect(getPlatformBlogOgImageData('missing-post')).resolves.toEqual({
      businessName: 'Baci',
      featuredDataUri: null,
      featuredImageStatus: 'source_missing',
      logoDataUri: `data:image/png;base64,${Buffer.from('logo').toString(
        'base64'
      )}`,
      post: null,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://usebaci.com/logo.png',
      expect.any(Object)
    );
  });

  it('prefers a Satori-compatible landscape variant', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce({
      author_name: 'Baci Editorial',
      category: 'Guides',
      featured_image_alt: 'Launch cover',
      featured_image_height: 675,
      featured_image_url:
        'https://usebaci.com/media/platform/blog/original.jpg',
      featured_image_variants: {
        landscape_16x9:
          'https://usebaci.com/media/platform/blog/landscape_16x9.jpg',
      },
      featured_image_width: 1200,
      title: 'Launch Faster',
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('landscape_16x9.jpg')) {
        return Promise.resolve(imageResponse('image/jpeg', 'variant'));
      }
      if (url.endsWith('/logo.png')) {
        return Promise.resolve(imageResponse('image/png', 'logo'));
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await getPlatformBlogOgImageData('launch-faster');

    expect(result.featuredDataUri).toBe(
      `data:image/jpeg;base64,${Buffer.from('variant').toString('base64')}`
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://usebaci.com/media/platform/blog/landscape_16x9.jpg',
      expect.any(Object)
    );
  });

  it('skips webp landscape variants and falls back to the original featured image', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce({
      author_name: 'Baci Editorial',
      category: 'Guides',
      featured_image_alt: 'Launch cover',
      featured_image_height: 675,
      featured_image_url:
        'https://usebaci.com/media/platform/blog/original.jpg',
      featured_image_variants: {
        landscape_16x9:
          'https://usebaci.com/media/platform/blog/launch/landscape_16x9.webp',
      },
      featured_image_width: 1200,
      title: 'Launch Faster',
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('/original.jpg')) {
        return Promise.resolve(imageResponse('image/jpeg', 'original'));
      }
      if (url.endsWith('/logo.png')) {
        return Promise.resolve(imageResponse('image/png', 'logo'));
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await getPlatformBlogOgImageData('launch-faster');

    expect(result.featuredDataUri).toBe(
      `data:image/jpeg;base64,${Buffer.from('original').toString('base64')}`
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://usebaci.com/media/platform/blog/original.jpg',
      expect.any(Object)
    );
  });
});
