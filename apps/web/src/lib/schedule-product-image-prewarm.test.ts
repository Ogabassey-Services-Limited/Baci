import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';
import { scheduleProductImageTransformsPrewarm } from '@/lib/schedule-product-image-prewarm';

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

describe('scheduleProductImageTransformsPrewarm', () => {
  beforeEach(() => {
    mockPrewarm.mockClear();
  });

  it('schedules no prewarm when the raw images yield no valid urls', () => {
    scheduleProductImageTransformsPrewarm([]);
    scheduleProductImageTransformsPrewarm(undefined);
    scheduleProductImageTransformsPrewarm('not-an-array');
    scheduleProductImageTransformsPrewarm([{ url: '' }, { notUrl: 'x' }, null]);
    expect(mockPrewarm).not.toHaveBeenCalled();
  });

  it('extracts urls from mixed string/object shapes, warming the default matrix for every image and the q70 tier for the primary only', () => {
    // Raw `images` column shape: a { url } object, a bare string, and an empty
    // entry that must be dropped by the internal extraction.
    scheduleProductImageTransformsPrewarm([
      { url: PRIMARY },
      SECOND,
      { url: '' },
    ]);

    // Default product matrix (PDP hero + listing card) for EVERY valid image.
    expect(mockPrewarm).toHaveBeenCalledWith([PRIMARY, SECOND]);
    // Dedicated home-hero q70 warm — PRIMARY image only, its own invocation.
    expect(mockPrewarm).toHaveBeenCalledWith([PRIMARY], {
      widthQualityPairs: HOME_HERO_IMAGE_WIDTH_QUALITY_PAIRS,
    });
    expect(mockPrewarm).toHaveBeenCalledTimes(2);
  });
});
