import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductDetailsBannerSection } from './product-details-banner-section';

vi.mock('./product-details-page-lazy-components', () => ({
  BannerCarousel: ({ className }: { className?: string }) => (
    <div data-testid="banner-carousel" className={className} />
  ),
}));

describe('ProductDetailsBannerSection', () => {
  it('renders the banner carousel on desktop viewports', () => {
    render(<ProductDetailsBannerSection isDesktop />);

    expect(screen.getByTestId('product-banner-carousel')).toBeInTheDocument();
    expect(screen.getByTestId('banner-carousel')).toBeInTheDocument();
  });

  it('keeps the banner section without mounting the carousel on non-desktop viewports', () => {
    render(<ProductDetailsBannerSection isDesktop={false} />);

    expect(screen.getByTestId('product-banner-carousel')).toBeInTheDocument();
    expect(screen.queryByTestId('banner-carousel')).not.toBeInTheDocument();
  });
});
