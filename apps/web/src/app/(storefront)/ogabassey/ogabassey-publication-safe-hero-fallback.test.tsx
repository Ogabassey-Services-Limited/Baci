import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  HERO_MOBILE_IMAGE_COLUMN_CLASSES,
  HERO_MOBILE_TEXT_COLUMN_CLASSES,
  HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS,
} from '@/components/storefront/ogabassey/components/hero-mobile-geometry';

/** Build a CSS selector from a space-separated Tailwind class constant. */
const classSelector = (classes: string) =>
  `.${classes.trim().split(/\s+/).join('.')}`;

import { OgabasseyPublicationSafeHeroFallback } from './ogabassey-publication-safe-hero-fallback';

const HERO_IMAGE_URL =
  'https://cdn.ogabassey.com/core-assets/products/tecno.avif';

describe('OgabasseyPublicationSafeHeroFallback', () => {
  it('paints the decorative slide-0 hero image with empty alt and carousel space', () => {
    const { container } = render(
      <OgabasseyPublicationSafeHeroFallback
        hasCarouselControls
        heroImageUrl={HERO_IMAGE_URL}
      />
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

    // The LCP hero image now paints in the shell so LCP lands at FCP.
    const picture = container.querySelector('picture');
    expect(picture).toBeInTheDocument();
    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();
    // Decorative placeholder: empty alt, never a described product image.
    expect(image).toHaveAttribute('alt', '');
    // The requested slide-0 image is what the <picture> resolves.
    expect(picture?.querySelector('source')?.getAttribute('srcset')).toContain(
      HERO_IMAGE_URL
    );

    // Geometry lock (regression guard for the full-width mispaint the fable
    // review and Codex both flagged): the image paints in the real slide's 40%
    // image column (col-span-2) inside the grid, so `sizes` selects the right
    // source and the streamed Hero swap causes no resize/recomposition.
    const imageColumn = container.querySelector(
      classSelector(HERO_MOBILE_IMAGE_COLUMN_CLASSES)
    );
    expect(imageColumn).toContainElement(picture);
    // The mirrored 60% text column reserves the slot but stays empty — no copy.
    const textColumn = container.querySelector(
      classSelector(HERO_MOBILE_TEXT_COLUMN_CLASSES)
    );
    expect(textColumn).toBeInTheDocument();
    expect(textColumn?.textContent).toBe('');
  });

  it('renders no image while keeping the inert skeleton when the feed is empty', () => {
    const { container } = render(
      <OgabasseyPublicationSafeHeroFallback
        hasCarouselControls={false}
        heroImageUrl={null}
      />
    );

    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-hero-fallback="true"]'
      )
    ).toBeInTheDocument();
    expect(container.querySelector('img, picture')).not.toBeInTheDocument();
  });

  it('omits carousel space for a single slide', () => {
    const { container } = render(
      <OgabasseyPublicationSafeHeroFallback
        hasCarouselControls={false}
        heroImageUrl={HERO_IMAGE_URL}
      />
    );

    expect(
      container.querySelector(
        '[data-ogabassey-publication-safe-carousel-controls="true"]'
      )
    ).not.toBeInTheDocument();
  });

  describe('security line: image-only, never shopping UI', () => {
    it('emits no anchors, links, buttons, or interactive controls even with a hero image', () => {
      const { container } = render(
        <OgabasseyPublicationSafeHeroFallback
          hasCarouselControls
          heroImageUrl={HERO_IMAGE_URL}
        />
      );

      // The dynamic Hero remains the sole owner of every shopping affordance.
      expect(container.querySelector('a')).not.toBeInTheDocument();
      expect(container.querySelector('[href]')).not.toBeInTheDocument();
      expect(container.querySelector('button')).not.toBeInTheDocument();
      expect(
        container.querySelector('a, button, [role="link"], [role="button"]')
      ).not.toBeInTheDocument();
    });

    it('emits no product copy, price, or PDP navigation text', () => {
      const { container } = render(
        <OgabasseyPublicationSafeHeroFallback
          hasCarouselControls
          heroImageUrl={HERO_IMAGE_URL}
        />
      );

      // The fallback receives only the image URL — no name/price/CTA can leak.
      const text = container.textContent ?? '';
      expect(text).not.toContain('Tecno Spark 40 Pro');
      expect(text).not.toContain('₦');
      expect(text).not.toContain('Shop now');
      expect(text.trim()).toBe('');
    });
  });
});
