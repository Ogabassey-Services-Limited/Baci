import { describe, expect, it } from 'vitest';
import {
  DESKTOP_IPHONE_SLIDES,
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
  MOBILE_SLIDES,
  OGABASSEY_HERO_PRELOAD_IDENTIFIERS,
} from '@/components/storefront/ogabassey/components/hero-data';

const APPLE_IMAGE_ORIGIN = 'https://store.storeimages.cdn-apple.com/';

function getRequiredImageDimension(imageUrl: URL, key: 'wid' | 'hei') {
  const rawValue = imageUrl.searchParams.get(key);

  expect(rawValue).not.toBeNull();

  const parsedValue = Number.parseInt(rawValue ?? '', 10);
  expect(Number.isFinite(parsedValue)).toBe(true);

  return parsedValue;
}

describe('hero-data exports', () => {
  it('does not request oversized Apple desktop hero images', () => {
    const appleSlides = DESKTOP_IPHONE_SLIDES.filter((slide) =>
      slide.image.startsWith(APPLE_IMAGE_ORIGIN)
    );

    expect(appleSlides.length).toBeGreaterThan(0);

    for (const slide of appleSlides) {
      const imageUrl = new URL(slide.image);
      const width = getRequiredImageDimension(imageUrl, 'wid');
      const height = getRequiredImageDimension(imageUrl, 'hei');

      expect(width).toBeLessThanOrEqual(1920);
      expect(height).toBeLessThanOrEqual(1080);
    }
  });

  it('does not request oversized Apple mobile hero images when present', () => {
    const appleSlides = MOBILE_SLIDES.filter((slide) =>
      slide.src?.startsWith(APPLE_IMAGE_ORIGIN)
    );

    for (const slide of appleSlides) {
      const imageUrl = new URL(slide.src ?? '');
      const width = getRequiredImageDimension(imageUrl, 'wid');
      const height = getRequiredImageDimension(imageUrl, 'hei');

      expect(width).toBeLessThanOrEqual(750);
      expect(height).toBeLessThanOrEqual(1334);
    }
  });

  it('exports server-safe LCP image sources that match the first rendered slides', () => {
    expect(DESKTOP_IPHONE_SLIDES.length).toBeGreaterThan(0);
    expect(MOBILE_SLIDES.length).toBeGreaterThan(0);
    const desktopLcpSlide = DESKTOP_IPHONE_SLIDES[0];
    const mobileLcpSlide = MOBILE_SLIDES[0];

    expect(desktopLcpSlide).toBeDefined();
    expect(mobileLcpSlide).toBeDefined();
    expect(HERO_DESKTOP_LCP_SRC).toMatch(/\.avif(?:$|\?)/);
    expect(HERO_MOBILE_LCP_SRC).toMatch(/\.avif(?:$|\?)/);
    expect(desktopLcpSlide?.image).toBe(HERO_DESKTOP_LCP_SRC);
    expect(mobileLcpSlide?.src).toBe(HERO_MOBILE_LCP_SRC);
  });

  it('exports the storefront identifiers that should receive hero resource hints', () => {
    expect(OGABASSEY_HERO_PRELOAD_IDENTIFIERS.has('ogabassey')).toBe(true);
    expect(OGABASSEY_HERO_PRELOAD_IDENTIFIERS.has('ogabassey.com')).toBe(true);
    expect(OGABASSEY_HERO_PRELOAD_IDENTIFIERS.has('another-shop')).toBe(false);
    // proxy.ts normalises 'www.ogabassey.com' down to 'ogabassey.com' before
    // the storefront [slug] route runs, so the www form should not be in the Set.
    expect(OGABASSEY_HERO_PRELOAD_IDENTIFIERS.has('www.ogabassey.com')).toBe(
      false
    );
  });
});
