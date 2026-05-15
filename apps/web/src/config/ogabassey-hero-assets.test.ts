import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_HERO_ASSET_CACHE_CONTROL,
  OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC,
  OGABASSEY_HERO_DESKTOP_LCP_SRC,
  OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC,
  OGABASSEY_HERO_MOBILE_LCP_SRC,
} from './ogabassey-hero-assets';

describe('ogabassey hero asset config', () => {
  it('keeps home LCP hero assets on stable public URLs for head preloads', () => {
    expect(OGABASSEY_HERO_DESKTOP_LCP_SRC).toBe(
      '/ogabassey/hero/iphone-17-pro-max-desktop.011z-1gfy2svu.avif'
    );
    expect(OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC).toBe(
      '/ogabassey/hero/iphone-17-pro-max-desktop.011z-1gfy2svu.jpg'
    );
    expect(OGABASSEY_HERO_MOBILE_LCP_SRC).toBe(
      '/ogabassey/hero/iphone-17-pro-max-mobile.02p9~ertxbycj.avif'
    );
    expect(OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC).toBe(
      '/ogabassey/hero/iphone-17-pro-max-mobile.0l7mj_a~pxwb9.jpg'
    );
  });

  it('keeps versioned public hero assets cacheable for returning visitors', () => {
    expect(OGABASSEY_HERO_ASSET_CACHE_CONTROL).toBe(
      'public, max-age=31536000, immutable'
    );
  });
});
