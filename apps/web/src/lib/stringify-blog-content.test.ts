import { describe, expect, it } from 'vitest';
import { stringifyBlogContent } from '@/lib/stringify-blog-content';

describe('stringifyBlogContent', () => {
  it('returns strings unchanged', () => {
    expect(stringifyBlogContent('<p>hello</p>')).toBe('<p>hello</p>');
  });

  it('serializes TipTap document objects', () => {
    expect(stringifyBlogContent({ type: 'doc', content: [] })).toBe(
      '{"type":"doc","content":[]}'
    );
  });

  it('returns an empty string for null, undefined, and non-object values', () => {
    expect(stringifyBlogContent(null)).toBe('');
    expect(stringifyBlogContent(undefined)).toBe('');
    expect(stringifyBlogContent(42)).toBe('');
  });
});
