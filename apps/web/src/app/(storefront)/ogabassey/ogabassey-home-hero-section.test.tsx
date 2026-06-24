import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyHomeHeroSection } from './ogabassey-home-hero-section';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

vi.mock('./ogabassey-home-launch-products', () => ({
  loadOgabasseyLaunchProducts: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/components/Hero', () => ({
  Hero: ({ slides }: { slides: Array<{ href: string; name: string }> }) => (
    <section aria-label="Streamed product hero">
      {slides.map((slide) => (
        <a href={slide.href} key={slide.href}>
          {slide.name}
        </a>
      ))}
    </section>
  ),
}));

const launchProduct: Product = {
  id: 'product-1',
  name: 'Samsung Galaxy A27 5G',
  slug: 'samsung-galaxy-a27-5g',
  description: '',
  price: '₦50,000',
  stock: 2,
  image: 'https://cdn.ogabassey.com/products/a27.avif',
  category: 'Smartphones',
  images: [],
};

describe('OgabasseyHomeHeroSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadOgabasseyLaunchProducts).mockResolvedValue([launchProduct]);
  });

  it('loads launch products and renders hero links inside the published storefront boundary', async () => {
    const result = await OgabasseyHomeHeroSection({
      merchantId: 'merchant-1',
      pathPrefix: '/ogabassey',
    });

    render(result as ReactElement);

    expect(loadOgabasseyLaunchProducts).toHaveBeenCalledWith('merchant-1');
    expect(
      screen.getByRole('link', { name: 'Samsung Galaxy A27 5G' })
    ).toHaveAttribute('href', '/ogabassey/smartphones/samsung-galaxy-a27-5g');
  });

  it('renders the hero with no slides when the launch feed degrades to empty', async () => {
    // loadOgabasseyLaunchProducts is best-effort and resolves [] on feed failure;
    // the uncached wrapper must render (Hero falls back to empty geometry), not
    // cache the transient empty state.
    vi.mocked(loadOgabasseyLaunchProducts).mockResolvedValue([]);

    const result = await OgabasseyHomeHeroSection({
      merchantId: 'merchant-1',
      pathPrefix: '/ogabassey',
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('region', { name: 'Streamed product hero' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
