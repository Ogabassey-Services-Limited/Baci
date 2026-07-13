import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS } from '@/components/storefront/ogabassey/components/hero-mobile-geometry';
import { OgabasseyPublicationSafeHeroFallback } from './ogabassey-publication-safe-hero-fallback';

describe('OgabasseyPublicationSafeHeroFallback', () => {
  it('renders inert publication-safe geometry with carousel space', () => {
    const { container } = render(
      <OgabasseyPublicationSafeHeroFallback hasCarouselControls />
    );

    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-hero-fallback="true"]'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-carousel-controls="true"]'
      )
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-utility-fallback="true"]'
      )
    ).toHaveClass(HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS);
    expect(container.querySelector('a, button, img')).not.toBeInTheDocument();
  });

  it('omits carousel space for a single slide', () => {
    const { container } = render(
      <OgabasseyPublicationSafeHeroFallback hasCarouselControls={false} />
    );

    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-carousel-controls="true"]'
      )
    ).not.toBeInTheDocument();
  });
});
