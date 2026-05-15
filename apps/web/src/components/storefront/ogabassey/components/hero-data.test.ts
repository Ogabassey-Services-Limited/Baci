import { describe, expect, it } from 'vitest';
import {
  DESKTOP_IPHONE_SLIDES,
  FLASH_SALE_PROMO_IMAGE,
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
  MOBILE_SLIDES,
  NEW_ARRIVALS_PROMO_IMAGE,
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
  it('keeps desktop hero slides on the local iPhone 17 asset instead of Apple hotlinks', () => {
    const appleSlides = DESKTOP_IPHONE_SLIDES.filter((slide) =>
      slide.image.startsWith(APPLE_IMAGE_ORIGIN)
    );

    expect(appleSlides).toHaveLength(0);
    for (const slide of DESKTOP_IPHONE_SLIDES) {
      expect(slide.image).toBe(HERO_DESKTOP_LCP_SRC);
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
    expect(HERO_MOBILE_LCP_FALLBACK_SRC).toMatch(/\.jpg(?:$|\?)/);
    expect(HERO_DESKTOP_LCP_SRC).toMatch(/^\/ogabassey\/hero\//);
    expect(HERO_MOBILE_LCP_SRC).toMatch(/^\/ogabassey\/hero\//);
    expect(HERO_MOBILE_LCP_FALLBACK_SRC).toMatch(/^\/ogabassey\/hero\//);
    expect(desktopLcpSlide?.image).toBe(HERO_DESKTOP_LCP_SRC);
    expect(mobileLcpSlide?.src).toBe(HERO_MOBILE_LCP_SRC);
  });

  it('keeps the MacBook promo off the failing CDN transformer path', () => {
    expect(NEW_ARRIVALS_PROMO_IMAGE).toMatch(/macbook-pro-promo\.avif/);
    expect(NEW_ARRIVALS_PROMO_IMAGE).not.toContain(
      'cdn.ogabassey.com/core-assets/products/macbook-pro.avif'
    );
  });

  it('keeps the PS5 promo on its transformable CDN asset', () => {
    const flashSaleUrl = new URL(FLASH_SALE_PROMO_IMAGE);

    expect(flashSaleUrl.hostname).toBe('cdn.ogabassey.com');
    expect(flashSaleUrl.pathname).toContain(
      '/core-assets/products/ps5-digital-slim-console-1tb.avif'
    );
  });
});
