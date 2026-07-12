import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';
import {
  extractProductImageUrls,
  scheduleProductImageTransformsPrewarm,
} from '@/lib/schedule-product-image-prewarm';

// Run the after() callback synchronously so the fire-and-forget prewarm is
// observable in the test (mirrors the real request-context behaviour).
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    fn();
  },
}));

const mockPrewarm = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/ogabassey-image-prewarm', () => ({
  prewarmOgabasseyImageTransforms: (...args: unknown[]) => mockPrewarm(...args),
}));

const PRIMARY = 'https://cdn.ogabassey.com/products/phone.avif';
const SECOND = 'https://cdn.ogabassey.com/products/phone-back.avif';

describe('extractProductImageUrls', () => {
  it('returns every non-empty url from string and object image shapes', () => {
    expect(
      extractProductImageUrls([PRIMARY, { url: SECOND }, 'https://x/c.avif'])
    ).toEqual([PRIMARY, SECOND, 'https://x/c.avif']);
  });

  it('drops empty, missing, and non-string urls, and non-arrays', () => {
    expect(
      extractProductImageUrls([
        { url: '' },
        { notUrl: 'x' },
        null,
        42,
        { url: PRIMARY },
      ])
    ).toEqual([PRIMARY]);
    expect(extractProductImageUrls(undefined)).toEqual([]);
    expect(extractProductImageUrls('nope')).toEqual([]);
  });
});

describe('scheduleProductImageTransformsPrewarm', () => {
  beforeEach(() => {
    mockPrewarm.mockClear();
  });

  it('does not schedule any prewarm for an empty image list', () => {
    scheduleProductImageTransformsPrewarm([]);
    expect(mockPrewarm).not.toHaveBeenCalled();
  });

  it('warms the default matrix for every image and the q70 tier for the primary only', () => {
    scheduleProductImageTransformsPrewarm([PRIMARY, SECOND]);

    // Default product matrix (PDP hero + listing card) for EVERY image.
    expect(mockPrewarm).toHaveBeenCalledWith([PRIMARY, SECOND]);
    // Dedicated home-hero q70 warm — PRIMARY image only, its own invocation.
    expect(mockPrewarm).toHaveBeenCalledWith([PRIMARY], {
      widthQualityPairs: HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS,
    });
    expect(mockPrewarm).toHaveBeenCalledTimes(2);
  });
});
