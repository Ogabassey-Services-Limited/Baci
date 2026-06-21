import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactEventHandler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HeroImage, ProductCardImage } from './optimized-image';

interface MockNextImageProps {
  alt: string;
  blurDataURL?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'eager' | 'lazy';
  onError?: ReactEventHandler<HTMLImageElement>;
  placeholder?: 'blur' | 'empty';
  preload?: boolean;
  priority?: boolean;
  src: string | { src: string };
  [key: string]: unknown;
}

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
  }: MockNextImageProps) => (
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

  it('switches to the fallback source and calls onError when the image fails', () => {
    const onError = vi.fn();

    render(
      <HeroImage
        alt="Broken hero"
        fallbackSrc="/hero-fallback.png"
        onError={onError}
        src="/broken-hero.png"
      />
    );

    const image = screen.getByRole('img', { name: 'Broken hero' });

    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/hero-fallback.png');
    expect(onError).toHaveBeenCalledOnce();
  });
});
