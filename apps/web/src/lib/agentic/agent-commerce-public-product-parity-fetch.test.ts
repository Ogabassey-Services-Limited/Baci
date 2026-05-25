import { describe, expect, it, vi } from 'vitest';
import {
  fetchPublicProductParityResponse,
  MAX_PARITY_REDIRECTS,
  PARITY_FEED_FETCH_TIMEOUT_MS,
  PARITY_FETCH_TIMEOUT_MS,
} from './agent-commerce-public-product-parity-fetch';

const STORE_ORIGIN = 'https://ogabassey.com';
const PRODUCT_URL = `${STORE_ORIGIN}/phones/test-phone`;
const options = { accept: 'text/html', expectedOrigin: STORE_ORIGIN };

describe('fetchPublicProductParityResponse', () => {
  it('allows callers to extend the timeout for feed downloads', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('feed'));

    try {
      await fetchPublicProductParityResponse(fetcher, PRODUCT_URL, {
        ...options,
        timeoutMs: PARITY_FEED_FETCH_TIMEOUT_MS,
      });
      expect(timeout).toHaveBeenCalledWith(PARITY_FEED_FETCH_TIMEOUT_MS);
    } finally {
      timeout.mockRestore();
    }
  });

  it('follows a relative same-origin redirect in manual mode', async () => {
    const redirectedUrl = `${STORE_ORIGIN}/phones/canonical-phone`;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: '/phones/canonical-phone' },
          status: 302,
        })
      )
      .mockResolvedValueOnce(new Response('page'));

    const response = await fetchPublicProductParityResponse(
      fetcher,
      PRODUCT_URL,
      options
    );

    expect(response?.ok).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      PRODUCT_URL,
      expect.objectContaining({ redirect: 'manual' })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      redirectedUrl,
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('does not follow an absolute redirect outside the storefront origin', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, {
        headers: { location: 'https://outside.example/phones/test-phone' },
        status: 302,
      })
    );

    expect(
      await fetchPublicProductParityResponse(fetcher, PRODUCT_URL, options)
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects an initial URL outside the expected storefront origin', async () => {
    const fetcher = vi.fn<typeof fetch>();

    expect(
      await fetchPublicProductParityResponse(
        fetcher,
        'https://outside.example/phone',
        options
      )
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a fetched response attributed to another origin', async () => {
    const response = new Response('page');
    Object.defineProperty(response, 'url', {
      value: 'https://outside.example/phone',
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response);

    expect(
      await fetchPublicProductParityResponse(fetcher, PRODUCT_URL, options)
    ).toBeNull();
  });

  it('returns null for non-success responses and rejected fetches', async () => {
    const nonSuccess = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('error', { status: 500 }));
    const rejected = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('fetch failed'));

    expect(
      await fetchPublicProductParityResponse(nonSuccess, PRODUCT_URL, options)
    ).toBeNull();
    expect(
      await fetchPublicProductParityResponse(rejected, PRODUCT_URL, options)
    ).toBeNull();
  });

  it('rejects redirects without a location or beyond the redirect limit', async () => {
    const missingLocation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302 }));
    const looping = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        headers: { location: '/phones/loop' },
        status: 302,
      })
    );

    expect(
      await fetchPublicProductParityResponse(
        missingLocation,
        PRODUCT_URL,
        options
      )
    ).toBeNull();
    expect(
      await fetchPublicProductParityResponse(looping, PRODUCT_URL, options)
    ).toBeNull();
    expect(looping).toHaveBeenCalledTimes(MAX_PARITY_REDIRECTS + 1);
  });

  it('returns null when a timed fetch aborts', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort());
    const fetcher = vi.fn<typeof fetch>((_url, init) =>
      init?.signal?.aborted
        ? Promise.reject(new Error('abort'))
        : Promise.resolve(new Response('page'))
    );

    try {
      await expect(
        fetchPublicProductParityResponse(fetcher, PRODUCT_URL, options)
      ).resolves.toBeNull();
      expect(timeout).toHaveBeenCalledWith(PARITY_FETCH_TIMEOUT_MS);
    } finally {
      timeout.mockRestore();
    }
  });
});
