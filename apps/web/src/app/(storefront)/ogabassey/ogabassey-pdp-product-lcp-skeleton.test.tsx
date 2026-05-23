import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpProductLcpSkeleton } from './ogabassey-pdp-product-lcp-skeleton';

vi.mock('server-only', () => ({}));

const { mockGetRequestScopedMerchant, mockGetCachedStorefrontProductLcpImage } =
  vi.hoisted(() => ({
    mockGetRequestScopedMerchant: vi.fn(),
    mockGetCachedStorefrontProductLcpImage: vi.fn(),
  }));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: mockGetRequestScopedMerchant,
}));

vi.mock('@/lib/storefront-product-lcp-image', () => ({
  getCachedStorefrontProductLcpImage: mockGetCachedStorefrontProductLcpImage,
}));

const mockGetImageProps = vi.hoisted(() =>
  vi.fn((props: { src: string; sizes?: string }) => ({
    props: {
      sizes: props.sizes,
      src: props.src,
      srcSet: `${props.src} 640w`,
    },
  }))
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

const mockMerchant = {
  id: 'merchant-123',
  template_id: 'ogabassey',
};

describe('OgabasseyPdpProductLcpSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null if merchant does not match template', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce({
      ...mockMerchant,
      template_id: 'default',
    });
    const result = await OgabasseyPdpProductLcpSkeleton({
      slug: 'test-store',
      productSlug: 'test-product',
    });
    expect(result).toBeNull();
  });

  it('renders general pulsator fallback if primary LCP image is missing', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce(mockMerchant);
    mockGetCachedStorefrontProductLcpImage.mockResolvedValueOnce(null);

    const component = await OgabasseyPdpProductLcpSkeleton({
      slug: 'test-store',
      productSlug: 'test-product',
    });
    expect(component).not.toBeNull();
    if (!component) throw new Error('Component is null');
    const html = renderToString(component);
    expect(html).toContain('ogabassey-pdp-lcp-skeleton');
    expect(html).toContain('animate-pulse');
  });

  it('renders visual grid layout with statically pre-rendered img element when LCP image exists', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce(mockMerchant);
    mockGetCachedStorefrontProductLcpImage.mockResolvedValueOnce(
      'https://cdn.ogabassey.com/lenovo.avif'
    );

    const component = await OgabasseyPdpProductLcpSkeleton({
      slug: 'test-store',
      productSlug: 'test-product',
    });
    expect(component).not.toBeNull();
    if (!component) throw new Error('Component is null');
    const html = renderToString(component);

    expect(html).toContain('ogabassey-pdp-lcp-skeleton');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://cdn.ogabassey.com/lenovo.avif"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('decoding="sync"');
    expect(html).toContain('Loading product');
  });
});
