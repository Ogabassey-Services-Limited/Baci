import { describe, expect, it } from 'vitest';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';

describe('getBlogCacheTag', () => {
  it('normalizes route identifier and post slug casing and whitespace', () => {
    expect(getBlogCacheTag(' OGABASSEY.COM ', ' Best-Deals ')).toBe(
      'blog-ogabassey.com-best-deals'
    );
  });
});
