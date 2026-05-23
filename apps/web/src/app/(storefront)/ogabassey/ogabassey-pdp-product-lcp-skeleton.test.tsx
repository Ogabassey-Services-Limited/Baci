import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpProductLcpSkeleton } from './ogabassey-pdp-product-lcp-skeleton';

vi.mock('server-only', () => ({}));

const mockGetImageProps = vi.hoisted(() =>
  vi.fn((props: { src: string; sizes?: string; alt?: string }) => ({
    props: {
      sizes: props.sizes,
      src: props.src,
      srcSet: `${props.src} 640w`,
      alt: props.alt,
      style: { position: 'absolute', height: '100%', width: '100%' },
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

  it('returns null if merchant does not match template', () => {
    const result = OgabasseyPdpProductLcpSkeleton({
      merchant: {
        ...mockMerchant,
        template_id: 'default',
      } as any,
      primaryProductImage: 'https://cdn.ogabassey.com/lenovo.avif',
    });
    expect(result).toBeNull();
  });

  it('renders general pulsator fallback if primary LCP image is missing', () => {
    const component = OgabasseyPdpProductLcpSkeleton({
      merchant: mockMerchant as any,
      primaryProductImage: null,
    });
    expect(component).not.toBeNull();
    if (!component) throw new Error('Component is null');
    const html = renderToString(component);
    expect(html).toContain('ogabassey-pdp-lcp-skeleton');
    expect(html).toContain('animate-pulse');
  });

  it('renders visual grid layout with statically pre-rendered img element when LCP image exists', () => {
    const component = OgabasseyPdpProductLcpSkeleton({
      merchant: mockMerchant as any,
      primaryProductImage: 'https://cdn.ogabassey.com/lenovo.avif',
    });
    expect(component).not.toBeNull();
    if (!component) throw new Error('Component is null');
    const html = renderToString(component);

    expect(html).toContain('ogabassey-pdp-lcp-skeleton');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://cdn.ogabassey.com/lenovo.avif"');
    expect(html).toContain('style="position:absolute;height:100%;width:100%"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('decoding="sync"');
    expect(html).toContain('Loading product');
  });
});
