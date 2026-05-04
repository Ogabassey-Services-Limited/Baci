import { describe, expect, it, vi } from 'vitest';

vi.mock('./assets/iphone-17-pro-max-desktop.avif', () => ({ default: '/mock-desktop.avif' }));
vi.mock('./assets/iphone-17-pro-max-mobile.avif', () => ({ default: '/mock-mobile.avif' }));

const { DESKTOP_IPHONE_SLIDES, FLASH_SALE_PROMO_IMAGE, MOBILE_SLIDES, NEW_ARRIVALS_PROMO_IMAGE } =
  await import('./hero-data');

describe('hero-data', () => {
  it('MOBILE_SLIDES has at least one slide with a valid type', () => {
    expect(MOBILE_SLIDES.length).toBeGreaterThan(0);
    for (const slide of MOBILE_SLIDES) {
      expect(['image', 'video', 'ad']).toContain(slide.type);
    }
  });

  it('DESKTOP_IPHONE_SLIDES has at least one slide with required fields', () => {
    expect(DESKTOP_IPHONE_SLIDES.length).toBeGreaterThan(0);
    for (const slide of DESKTOP_IPHONE_SLIDES) {
      expect(slide.id).toBeTypeOf('number');
      expect(slide.title).toBeTypeOf('string');
      expect(['light', 'dark']).toContain(slide.theme);
    }
  });

  it('promo image URLs are URI-encoded strings', () => {
    expect(NEW_ARRIVALS_PROMO_IMAGE).toBeTypeOf('string');
    expect(FLASH_SALE_PROMO_IMAGE).toBeTypeOf('string');
  });
});
