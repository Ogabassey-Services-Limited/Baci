import { describe, expect, it } from 'vitest';
import { HERO_MOBILE_LCP_FALLBACK_SRC } from '@/components/storefront/ogabassey/components/hero-data';

describe('hero-data exports', () => {
  it('exposes a server-safe static jpg fallback for the mobile hero LCP image', () => {
    // The eager hero art is now driven by live product images; the only value
    // hero-data still owns is the small static jpg used by MobileLcpHeroImage's
    // non-priority <source> decode path. It must stay a bundled static asset
    // (not a remote CDN transform) so the fallback decode never hits the network.
    const staticImportPathPattern =
      /^\/(?:_next\/static\/media\/|src\/components\/storefront\/ogabassey\/components\/assets\/)/;

    expect(HERO_MOBILE_LCP_FALLBACK_SRC).toMatch(/\.jpg(?:$|\?)/);
    expect(HERO_MOBILE_LCP_FALLBACK_SRC).toMatch(staticImportPathPattern);
  });
});
