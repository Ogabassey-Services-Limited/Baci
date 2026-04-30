import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'priority'
        )
      )}
      alt={String(props.alt ?? '')}
      data-priority={String(Boolean(props.priority))}
    />
  ),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((path: string) => path),
}));
vi.mock('../config/ads', () => ({ AD_CONFIG: {} }));
vi.mock('./AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit">Ad</div>,
}));

import { BannerCarousel } from './BannerCarousel';

describe('BannerCarousel', () => {
  it('renders without crashing', () => {
    const { container } = render(<BannerCarousel />);
    expect(container).toBeDefined();
  });

  it('does not request removed CDN banner assets or preload below-fold banners', () => {
    const { container } = render(<BannerCarousel />);
    const images = Array.from(container.querySelectorAll('img'));

    expect(images.map((image) => image.getAttribute('src'))).toEqual(
      expect.not.arrayContaining([
        'https://cdn.ogabassey.com/products/flash-sale-banner.avif',
        'https://cdn.ogabassey.com/products/new-arrivals-banner.avif',
      ])
    );

    for (const image of images) {
      expect(image).toHaveAttribute('data-priority', 'false');
    }
  });

  it('prioritizes only the custom category image when one is provided', () => {
    const { container } = render(
      <BannerCarousel categoryImage="/category-banner.avif" />
    );
    const images = Array.from(container.querySelectorAll('img'));

    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveAttribute('src', '/category-banner.avif');
    expect(images[0]).toHaveAttribute('data-priority', 'true');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');

    for (const image of images.slice(1)) {
      expect(image).toHaveAttribute('data-priority', 'false');
      expect(image).toHaveAttribute('fetchpriority', 'low');
    }
  });
});
