import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC,
  OGABASSEY_HERO_DESKTOP_LCP_SRC,
  OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC,
  OGABASSEY_HERO_MOBILE_LCP_SRC,
} from './ogabassey-hero-assets';

describe('ogabassey hero asset config', () => {
  it('resolves hero assets from static imports (Next build emits /_next/static/media)', () => {
    const staticImportPathPattern =
      /^\/(?:_next\/static\/media\/|src\/components\/storefront\/ogabassey\/components\/assets\/)/;

    expect(OGABASSEY_HERO_DESKTOP_LCP_SRC).toMatch(staticImportPathPattern);
    expect(OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC).toMatch(
      staticImportPathPattern
    );
    expect(OGABASSEY_HERO_MOBILE_LCP_SRC).toMatch(staticImportPathPattern);
    expect(OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC).toMatch(
      staticImportPathPattern
    );
  });

  it('never points hero assets at storefront slug namespaces', () => {
    for (const src of [
      OGABASSEY_HERO_DESKTOP_LCP_SRC,
      OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC,
      OGABASSEY_HERO_MOBILE_LCP_SRC,
      OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC,
    ]) {
      expect(src.startsWith('/ogabassey/')).toBe(false);
      expect(src.startsWith('/ogabassey-hero/')).toBe(false);
    }
  });
});
