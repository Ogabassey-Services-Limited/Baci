import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: () => null,
  getImageProps: vi.fn(({ sizes, src }: { sizes: string; src: string }) => ({
    props: { sizes, src, srcSet: `${src} 960w` },
  })),
}));

import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';

const SLIDES = [
  {
    kind: 'product' as const,
    id: 'p1',
    name: 'Tecno Spark 40 Pro',
    priceLabel: '₦250,000',
    href: '/smartphones/tecno-spark-40-pro',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/tecno.avif',
    imageAlt: 'Tecno Spark 40 Pro',
    ctaLabel: 'Shop now',
  },
  {
    kind: 'product' as const,
    id: 'p2',
    name: 'Dell XPS 16',
    priceLabel: '₦3,500,000',
    href: '/gaming-laptops/dell-xps-16',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/dell.avif',
    imageAlt: 'Dell XPS 16',
    ctaLabel: 'Shop now',
  },
];

describe('OgabasseyHomeHeroFallback', () => {
  it('preserves mobile and desktop hero geometry while dynamic content streams', () => {
    const { container } = render(<OgabasseyHomeHeroFallback />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Just Launched')).toBeInTheDocument();
  });

  it('renders the REAL slide-0 frame when cached shell slides are available', () => {
    render(<OgabasseyHomeHeroFallback shellSlides={SLIDES} />);

    // Same product name/price/CTA the streamed hero will render — the swap
    // must be visually a no-op.
    expect(screen.getByText('Tecno Spark 40 Pro')).toBeInTheDocument();
    expect(screen.getByText('₦250,000')).toBeInTheDocument();
    expect(screen.getByText('Shop now')).toBeInTheDocument();
    // The generic baked banner must NOT also render.
    expect(screen.queryByText('Just Launched')).not.toBeInTheDocument();
  });

  it('contains no links or interactive elements in the slide-0 frame (aria-hidden shell)', () => {
    const { container } = render(
      <OgabasseyHomeHeroFallback shellSlides={SLIDES} />
    );

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('falls back to the generic baked banner when shell slides are null', () => {
    render(<OgabasseyHomeHeroFallback shellSlides={null} />);

    expect(screen.getByText('Just Launched')).toBeInTheDocument();
  });
});
