import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { GET } from './route';

const mockGetCachedProductLcpHint = vi.fn();
const mockFetch = vi.fn();
let restoreFetch: () => void = () => undefined;
const mockImageLoader = vi.fn();
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const PRIMARY_PRODUCT_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif';

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

function createRequest(search = '', accept = 'image/avif') {
  return new NextRequest(
    `https://ogabassey.com/api/ogabassey/pdp-lcp-image/dell-alienware-m18-r3-rtx-5080${search}`,
    {
      headers: {
        accept,
      },
    }
  );
}

function createContext(productSlug = 'dell-alienware-m18-r3-rtx-5080') {
  return {
    params: Promise.resolve({ productSlug }),
  };
}

describe('GET /api/ogabassey/pdp-lcp-image/[productSlug]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((...args: Parameters<typeof fetch>) =>
        mockFetch(...args)
      );
    restoreFetch = () => fetchSpy.mockRestore();
    mockWarn.mockClear();
    mockImageLoader.mockReturnValue(PRIMARY_PRODUCT_IMAGE);
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

  it('redirects to the primary product image without proxy-fetching bytes', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [PRIMARY_PRODUCT_IMAGE],
      name: 'Dell Alienware m18 R3',
    });

    const response = await GET(
      createRequest('?width=750&quality=30'),
      createContext()
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
      OGABASSEY_MERCHANT_ID,
      'dell-alienware-m18-r3-rtx-5080',
      { includeVariants: false }
    );
    expect(mockImageLoader).not.toHaveBeenCalled();
  });

  it('returns 404 when the product has no primary image', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [],
      name: 'Dell Alienware m18 R3',
    });

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(404);
    expect(mockImageLoader).not.toHaveBeenCalled();
  });

  it('returns 500 when product lookup fails', async () => {
    mockGetCachedProductLcpHint.mockRejectedValueOnce(
      new Error('lookup failure')
    );

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(500);
    expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
      OGABASSEY_MERCHANT_ID,
      'dell-alienware-m18-r3-rtx-5080',
      { includeVariants: false }
    );
    expect(mockImageLoader).not.toHaveBeenCalled();
  });

  it('returns 400 before lookup for invalid product slugs', async () => {
    const response = await GET(createRequest(), createContext('../secret'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid product image preload request');
    expect(mockGetCachedProductLcpHint).not.toHaveBeenCalled();
  });
});
