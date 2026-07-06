import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';

const mockAfter = vi.fn();

vi.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));

const mockPrewarmOgabasseyImageTransforms = vi
  .fn()
  .mockResolvedValue(undefined);

vi.mock('@/lib/ogabassey-image-prewarm', () => ({
  prewarmOgabasseyImageTransforms: (...args: unknown[]) =>
    mockPrewarmOgabasseyImageTransforms(...args),
}));

import { schedulePrewarmBlogImageTransforms } from './ogabassey-blog-image-prewarm';

describe('schedulePrewarmBlogImageTransforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfter.mockImplementation((callback: () => void | Promise<void>) => {
      void callback();
    });
  });

  it('filters nullish/blank entries, dedupes, and prewarms with the blog variant matrix', () => {
    schedulePrewarmBlogImageTransforms([
      'https://cdn.ogabassey.com/blog/hero.avif',
      null,
      undefined,
      '',
      '   ',
      'https://cdn.ogabassey.com/blog/hero.avif',
      'https://cdn.ogabassey.com/blog/other.avif',
    ]);

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockPrewarmOgabasseyImageTransforms).toHaveBeenCalledTimes(1);
    expect(mockPrewarmOgabasseyImageTransforms).toHaveBeenCalledWith(
      [
        'https://cdn.ogabassey.com/blog/hero.avif',
        'https://cdn.ogabassey.com/blog/other.avif',
      ],
      { widthQualityPairs: BLOG_IMAGE_WIDTH_QUALITY_PAIRS }
    );
  });

  it('does not schedule anything when every entry is nullish or blank', () => {
    schedulePrewarmBlogImageTransforms([null, undefined, '', '  ']);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockPrewarmOgabasseyImageTransforms).not.toHaveBeenCalled();
  });

  it('does not schedule anything for an empty list', () => {
    schedulePrewarmBlogImageTransforms([]);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockPrewarmOgabasseyImageTransforms).not.toHaveBeenCalled();
  });

  it('falls back to a detached prewarm when after() throws outside a request scope', () => {
    mockAfter.mockImplementation(() => {
      throw new Error('after() was called outside a request scope');
    });

    schedulePrewarmBlogImageTransforms([
      'https://cdn.ogabassey.com/blog/hero.avif',
    ]);

    expect(mockPrewarmOgabasseyImageTransforms).toHaveBeenCalledTimes(1);
    expect(mockPrewarmOgabasseyImageTransforms).toHaveBeenCalledWith(
      ['https://cdn.ogabassey.com/blog/hero.avif'],
      { widthQualityPairs: BLOG_IMAGE_WIDTH_QUALITY_PAIRS }
    );
  });
});
