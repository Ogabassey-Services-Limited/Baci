import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOgabasseyPdpLcpImageResponse } from './ogabassey-pdp-lcp-image-response';

const mockGetCachedProductLcpHint = vi.fn();
const mockGetBaciCdnOriginFetchSecret = vi.fn();
const mockImageLoader = vi.fn();
const mockFetch = vi.fn();
let restoreFetch: () => void = () => undefined;
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

vi.mock('@/lib/cached-data', () => ({
  getCachedProductLcpHint: (...args: unknown[]) =>
    mockGetCachedProductLcpHint(...args),
  sanitizeLookupLogValue: (value: string) => value,
}));

vi.mock('@/env', () => ({
  getBaciCdnOriginFetchSecret: () => mockGetBaciCdnOriginFetchSecret(),
}));

vi.mock('@/lib/image-loader', () => ({
  default: (...args: unknown[]) => mockImageLoader(...args),
}));

describe('buildOgabasseyPdpLcpImageResponse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((...args: Parameters<typeof fetch>) =>
        mockFetch(...args)
      );
    restoreFetch = () => fetchSpy.mockRestore();
    mockWarn.mockClear();
    mockGetBaciCdnOriginFetchSecret.mockReturnValue(undefined);
    mockImageLoader.mockReturnValue(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=jpeg/core-assets/products/dell-alienware-17-r4.avif'
    );
    mockFetch.mockResolvedValue(
      new Response('image-bytes', {
        headers: {
          'content-type': 'image/avif',
        },
        status: 200,
      })
    );
  });

  afterEach(() => {
    restoreFetch();
    restoreFetch = () => undefined;
  });

  it('redirects valid preload inputs to the primary CDN image without proxy-fetching bytes', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });

    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: 30,
      width: 750,
    });

    expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
      expect.any(String),
      'dell-alienware-m18-r3-rtx-5080',
      { includeVariants: false }
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockImageLoader).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=jpeg/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(response.headers.get('location')).not.toContain('format=auto');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    );
  });

  it('returns 404 with a short cache when no primary image exists', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-2',
      images: [],
      name: 'Product Without Images',
    });

    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: 'product-without-images',
      quality: 30,
      width: 750,
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, s-maxage=60'
    );
    expect(mockImageLoader).not.toHaveBeenCalled();
  });

  it('returns 500 with a short cache when product lookup fails', async () => {
    mockGetCachedProductLcpHint.mockRejectedValueOnce(
      new Error('lookup failed')
    );

    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: 30,
      width: 750,
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, s-maxage=60'
    );
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to resolve OgaBassey PDP LCP preload image:',
      'dell-alienware-m18-r3-rtx-5080',
      expect.any(Error)
    );
    expect(mockImageLoader).not.toHaveBeenCalled();
  });

  it('redirects to the CDN image without depending on upstream server-side fetches', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });
    mockFetch.mockRejectedValueOnce(new Error('upstream image failed'));

    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: 30,
      width: 750,
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    );
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=jpeg/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch the CDN image before redirecting', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: 30,
      width: 750,
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=jpeg/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Transformed OgaBassey PDP LCP preload image')
    );
  });

  it('returns 400 before lookup for invalid preload inputs', async () => {
    const response = await buildOgabasseyPdpLcpImageResponse({
      productSlug: '../secret',
      quality: 30,
      width: 750,
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid product image preload request');
    expect(mockGetCachedProductLcpHint).not.toHaveBeenCalled();
  });
});
