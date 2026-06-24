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

  it('loads launch products in its own streamed boundary and renders hero links', async () => {
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
});
