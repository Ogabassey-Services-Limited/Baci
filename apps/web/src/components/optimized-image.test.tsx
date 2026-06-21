import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroImage, ProductCardImage } from './optimized-image';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    loading,
    placeholder: _placeholder,
    preload,
    priority,
    src,
    blurDataURL: _blurDataURL,
    ...props
  }: any) => (
    // biome-ignore lint/performance/noImgElement: this test mocks next/image to assert the exact props forwarded to it.
    <img
      alt={alt}
      data-fetch-priority={fetchPriority}
      data-loading={loading}
      data-preload={String(Boolean(preload))}
      data-priority={String(Boolean(priority))}
      src={typeof src === 'string' ? src : '/mock-static-image.png'}
      {...props}
    />
  ),
}));

vi.mock('@/lib/image-utils', () => ({
  getFallbackImage: () => '/fallback.png',
  getProductBlurPlaceholder: () => '',
  getResponsiveSizes: (layout: string) => `${layout}-sizes`,
  isValidImageUrl: () => true,
}));

describe('optimized image presets', () => {
  it('maps hero LCP images to Next 16 preload without deprecated priority', () => {
    render(<HeroImage alt="Blog hero" src="/blog-hero.png" />);

    const image = screen.getByRole('img', { name: 'Blog hero' });

    expect(image).toHaveAttribute('data-preload', 'true');
    expect(image).toHaveAttribute('data-priority', 'false');
    expect(image).toHaveAttribute('data-fetch-priority', 'high');
    expect(image).not.toHaveAttribute('data-loading');
  });

  it('keeps non-priority product cards lazy with low fetch priority', () => {
    render(<ProductCardImage alt="Blog card" src="/blog-card.png" />);

    const image = screen.getByRole('img', { name: 'Blog card' });

    expect(image).toHaveAttribute('data-preload', 'false');
    expect(image).toHaveAttribute('data-priority', 'false');
    expect(image).toHaveAttribute('data-loading', 'lazy');
    expect(image).toHaveAttribute('data-fetch-priority', 'low');
  });
});
