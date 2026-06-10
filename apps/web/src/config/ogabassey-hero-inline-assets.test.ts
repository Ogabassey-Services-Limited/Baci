import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_HERO_MOBILE_LCP_INLINE_BYTES,
  OGABASSEY_HERO_MOBILE_LCP_INLINE_SRC,
} from './ogabassey-hero-inline-assets';

const MAX_INLINE_ASSET_SIZE_BYTES = 3 * 1024;
const AVIF_SIGNATURE = 'ftypavif';
const AVIF_SIGNATURE_START = 4;
const AVIF_SIGNATURE_END = 12;

describe('ogabassey hero inline assets', () => {
  it('keeps the mobile LCP AVIF small enough to inline in the critical shell', () => {
    expect(OGABASSEY_HERO_MOBILE_LCP_INLINE_SRC).toMatch(
      /^data:image\/avif;base64,/
    );

    const encoded = OGABASSEY_HERO_MOBILE_LCP_INLINE_SRC.replace(
      /^data:image\/avif;base64,/,
      ''
    );
    const decoded = Buffer.from(encoded, 'base64');

    expect(decoded.byteLength).toBe(OGABASSEY_HERO_MOBILE_LCP_INLINE_BYTES);
    expect(decoded.byteLength).toBeLessThanOrEqual(MAX_INLINE_ASSET_SIZE_BYTES);
    expect(
      decoded.toString('ascii', AVIF_SIGNATURE_START, AVIF_SIGNATURE_END)
    ).toBe(AVIF_SIGNATURE);
  });
});
