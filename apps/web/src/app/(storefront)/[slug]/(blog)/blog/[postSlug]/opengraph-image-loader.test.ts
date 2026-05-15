import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN: 'https://cdn.ogabassey.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  },
}));

import {
  loadRemoteImageDataUri,
  MAX_REMOTE_IMAGE_BYTES,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-loader';
import { isAllowedBlogOgImageUrl } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-security';

function imageResponse(contentType = 'image/jpeg', body = 'image-bytes') {
  return new Response(body, {
    headers: contentType ? { 'content-type': contentType } : undefined,
    status: 200,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('merchant blog OG image loader', () => {
  it('fetches an allowed raster image as a data URI with bounded request options', async () => {
    mockFetch.mockResolvedValue(imageResponse('image/jpeg', 'featured'));

    const result = await loadRemoteImageDataUri(
      'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
      'blog-ogabassey-post',
      4000,
      (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
    );

    expect(result).toEqual({
      dataUri: `data:image/jpeg;base64,${Buffer.from('featured').toString(
        'base64'
      )}`,
      status: 'loaded',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        next: {
          revalidate: 3600,
          tags: ['blog-ogabassey-post'],
        },
      })
    );
  });

  it('fails closed when the source is missing or disallowed', async () => {
    await expect(
      loadRemoteImageDataUri(null, 'blog-ogabassey-post', 4000, () => true)
    ).resolves.toEqual({ dataUri: null, status: 'source_missing' });

    await expect(
      loadRemoteImageDataUri(
        'https://evil.example.com/media/merchant-1/blog/raw.webp',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'source_disallowed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns fetch_failed when the upstream response is not ok', async () => {
    mockFetch.mockResolvedValue(new Response('not found', { status: 404 }));

    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.webp',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'fetch_failed' });
  });

  it('fails closed when the upstream image omits or lies about content type', async () => {
    mockFetch.mockResolvedValueOnce(imageResponse('', 'bytes'));
    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.webp',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'invalid_content_type' });

    mockFetch.mockResolvedValueOnce(imageResponse('image/svg+xml', '<svg />'));
    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.svg',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'invalid_content_type' });

    mockFetch.mockResolvedValueOnce(imageResponse('image/webp', 'webp-bytes'));
    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.webp',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'invalid_content_type' });
  });

  it('rejects oversized images before buffering the response body', async () => {
    mockFetch.mockResolvedValue(
      new Response('small', {
        headers: {
          'content-length': String(MAX_REMOTE_IMAGE_BYTES + 1),
          'content-type': 'image/png',
        },
        status: 200,
      })
    );

    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.png',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'payload_too_large' });
  });

  it('stops reading streamed image bodies that exceed the payload cap', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_REMOTE_IMAGE_BYTES));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(
      new Response(stream, {
        headers: { 'content-type': 'image/png' },
        status: 200,
      })
    );

    await expect(
      loadRemoteImageDataUri(
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.png',
        'blog-ogabassey-post',
        4000,
        (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
      )
    ).resolves.toEqual({ dataUri: null, status: 'payload_too_large' });
  });

  it('returns timed_out when image fetch is aborted by the timeout', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const resultPromise = loadRemoteImageDataUri(
      'https://cdn.ogabassey.com/media/merchant-1/blog/raw.webp',
      'blog-ogabassey-post',
      4000,
      (url) => isAllowedBlogOgImageUrl(url, 'merchant-1')
    );

    await vi.advanceTimersByTimeAsync(4000);
    await expect(resultPromise).resolves.toEqual({
      dataUri: null,
      status: 'timed_out',
    });
  });
});
