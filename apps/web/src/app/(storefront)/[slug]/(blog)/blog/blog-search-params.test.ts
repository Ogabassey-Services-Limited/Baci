import { describe, expect, it } from 'vitest';
import { toSingleBlogSearchParam } from './blog-search-params';

describe('blog search params', () => {
  it('returns scalar search params as-is', () => {
    expect(toSingleBlogSearchParam('smartphones')).toBe('smartphones');
  });

  it('uses the first repeated search param value', () => {
    expect(toSingleBlogSearchParam(['smartphones', 'laptops'])).toBe(
      'smartphones'
    );
  });

  it('preserves undefined search params', () => {
    expect(toSingleBlogSearchParam(undefined)).toBeUndefined();
  });
});
