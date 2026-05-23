import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
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
    const { container } = render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={
          {
            ...mockMerchant,
            template_id: 'default',
          } as unknown as CachedMerchant
        }
        primaryProductImage="https://cdn.ogabassey.com/lenovo.avif"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders general pulsator fallback if primary LCP image is missing', () => {
    render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={mockMerchant as unknown as CachedMerchant}
        primaryProductImage={null}
      />
    );

    const skeleton = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(skeleton).toBeDefined();
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
  });

  it('renders visual grid layout with statically pre-rendered img element when LCP image exists', () => {
    render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={mockMerchant as unknown as CachedMerchant}
        primaryProductImage="https://cdn.ogabassey.com/lenovo.avif"
      />
    );

    const skeleton = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(skeleton).toBeDefined();
    expect(skeleton.className).not.toContain('animate-pulse');

    const img = screen.getByRole('img', {
      name: /loading product/i,
    }) as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.src).toBe('https://cdn.ogabassey.com/lenovo.avif');
    expect(img.style.position).toBe('absolute');
    expect(img.style.height).toBe('100%');
    expect(img.style.width).toBe('100%');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('decoding')).toBe('sync');
  });
});
