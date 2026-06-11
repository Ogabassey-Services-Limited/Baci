import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { GET } from './route';

const mockGetCachedProductLcpHint = vi.fn();
const mockImageLoader = vi.fn();
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

vi.mock('@/lib/cached-data', () => ({
  getCachedProductLcpHint: (...args: unknown[]) =>
    mockGetCachedProductLcpHint(...args),
  sanitizeLookupLogValue: (value: string) => value,
}));

vi.mock('@/lib/image-loader', () => ({
  default: (...args: unknown[]) => mockImageLoader(...args),
}));

function createRequest(search = '') {
  return new NextRequest(
    `https://ogabassey.com/api/ogabassey/pdp-lcp-image/dell-alienware-m18-r3-rtx-5080${search}`
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
    mockWarn.mockClear();
    mockImageLoader.mockReturnValue(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/dell-alienware-17-r4.avif'
    );
  });

  it('redirects to the transformed primary product image', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      ],
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
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
      OGABASSEY_MERCHANT_ID,
      'dell-alienware-m18-r3-rtx-5080'
    );
    expect(mockImageLoader).toHaveBeenCalledWith({
      quality: 30,
      src: 'https://cdn.ogabassey.com/core-assets/products/dell-alienware-17-r4.avif',
      width: 750,
    });
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
      'dell-alienware-m18-r3-rtx-5080'
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
