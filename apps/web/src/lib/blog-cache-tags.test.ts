import { describe, expect, it } from 'vitest';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';

describe('getBlogCacheTag', () => {
  it('normalizes route identifier and post slug casing and whitespace without exceeding tag limits', () => {
    const tag = getBlogCacheTag(' OGABASSEY.COM ', ' Best-Deals ');

    expect(tag).toMatch(/^blog-ogabassey\.com-best-deals-[a-f0-9]{32}$/);
    expect(tag).toBe(getBlogCacheTag('ogabassey.com', 'best-deals'));
    expect(tag.length).toBeLessThanOrEqual(256);
  });

  it('handles empty and whitespace-only inputs deterministically without colliding with real values', () => {
    const emptyTag = getBlogCacheTag('', '');
    const whitespaceTag = getBlogCacheTag('   ', '\n\t');
    const nonEmptyTag = getBlogCacheTag('empty', 'empty');

    expect(emptyTag).toBe(whitespaceTag);
    expect(emptyTag).toBe(getBlogCacheTag('', ''));
    expect(emptyTag).toMatch(/^blog-/);
    expect(emptyTag).not.toMatch(/\s/);
    expect(emptyTag).toBe(emptyTag.toLowerCase());
    expect(emptyTag).not.toBe(nonEmptyTag);
  });
});
