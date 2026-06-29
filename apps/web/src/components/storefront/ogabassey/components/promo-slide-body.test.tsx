import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LaunchPromoSlide } from './LaunchCarousel';
import { PromoSlideBody } from './promo-slide-body';

describe('PromoSlideBody', () => {
  it('renders title, subtitle and CTA without an image', () => {
    const promo: LaunchPromoSlide = {
      kind: 'promo',
      id: 'promo1',
      title: 'Flash Sale',
      subtitle: 'Up to 50% off',
      ctaLabel: 'Shop the sale',
    };

    const { container } = render(<PromoSlideBody slide={promo} />);

    expect(
      screen.getByRole('heading', { name: 'Flash Sale' })
    ).toBeInTheDocument();
    expect(screen.getByText('Up to 50% off')).toBeInTheDocument();
    expect(screen.getByText('Shop the sale')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('omits the subtitle and CTA when not provided', () => {
    const promo: LaunchPromoSlide = {
      kind: 'promo',
      id: 'promo2',
      title: 'New Arrivals',
    };

    const { container } = render(<PromoSlideBody slide={promo} />);

    expect(
      screen.getByRole('heading', { name: 'New Arrivals' })
    ).toBeInTheDocument();
    // No CTA pill...
    expect(screen.queryByText('Shop the sale')).not.toBeInTheDocument();
    // ...and no subtitle paragraph (the subtitle is the only <p> rendered).
    expect(container.querySelector('p')).toBeNull();
  });
});
