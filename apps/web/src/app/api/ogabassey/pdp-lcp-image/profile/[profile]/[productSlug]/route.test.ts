import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mockGetCachedProductLcpHint = vi.fn();
const mockFetch = vi.fn();
let restoreFetch: () => void = () => undefined;
const mockImageLoader = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedProductLcpHint: (...args: unknown[]) =>
    mockGetCachedProductLcpHint(...args),
  sanitizeLookupLogValue: (value: string) => value,
}));

vi.mock('@/env', () => ({
  getBaciCdnOriginFetchSecret: () => undefined,
}));

vi.mock('@/lib/image-loader', () => ({
  default: (...args: unknown[]) => mockImageLoader(...args),
}));

function createRequest(accept = 'image/avif') {
  return new NextRequest(
    'https://ogabassey.com/api/ogabassey/pdp-lcp-image/profile/mobile/dell-alienware-m18-r3-rtx-5080',
    {
      headers: {
        accept,
      },
    }
  );
}

function createContext(
  profile = 'mobile',
  productSlug = 'dell-alienware-m18-r3-rtx-5080'
) {
  return {
    params: Promise.resolve({ productSlug, profile }),
  };
}

describe('GET /api/ogabassey/pdp-lcp-image/profile/[profile]/[productSlug]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((...args: Parameters<typeof fetch>) =>
        mockFetch(...args)
      );
    restoreFetch = () => fetchSpy.mockRestore();
    mockImageLoader.mockReturnValue(
      'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif'
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

  it('redirects the mobile preload profile to the primary product image', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });

    const response = await GET(createRequest(), createContext('mobile'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    expect(mockImageLoader).toHaveBeenCalledWith({
      quality: 30,
      src: 'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      width: 750,
    });
  });

  it('redirects the desktop preload profile with desktop dimensions', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });

    const response = await GET(createRequest(), createContext('desktop'));

    expect(response.status).toBe(307);
    expect(mockImageLoader).toHaveBeenCalledWith({
      quality: 35,
      src: 'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      width: 640,
    });
  });

  it('redirects the mobile header profile with the actual mobile LCP candidate dimensions', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
      name: 'Dell Alienware m18 R3',
    });

    const response = await GET(createRequest(), createContext('mobile-header'));

    expect(response.status).toBe(307);
    expect(mockImageLoader).toHaveBeenCalledWith({
      quality: 35,
      src: 'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      width: 1080,
    });
  });

  it('returns 400 before lookup for invalid profiles', async () => {
    const response = await GET(createRequest(), createContext('tablet'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid product image preload profile');
    expect(mockGetCachedProductLcpHint).not.toHaveBeenCalled();
  });
});
