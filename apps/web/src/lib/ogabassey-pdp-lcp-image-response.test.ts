import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOgabasseyPdpLcpImageResponse } from './ogabassey-pdp-lcp-image-response';

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

describe('buildOgabasseyPdpLcpImageResponse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWarn.mockClear();
    mockImageLoader.mockReturnValue(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/dell-alienware-17-r4.avif'
    );
  });

  it('redirects valid preload inputs to the transformed primary image', async () => {
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

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/dell-alienware-17-r4.avif'
    );
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
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
