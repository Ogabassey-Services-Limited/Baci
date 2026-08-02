import { describe, expect, it } from 'vitest';
import { getNewBlogPostContentStats } from './new-blog-post-content-stats';

describe('getNewBlogPostContentStats', () => {
  it('counts prose nested in editor JSON and rounds the reading time up', () => {
    const content = JSON.stringify({
      content: [{ content: [{ text: 'One two three' }] }],
    });

    expect(getNewBlogPostContentStats(content)).toEqual({
      readingTime: 1,
      wordCount: 3,
    });
  });

  it('returns zeroes for malformed editor content', () => {
    expect(getNewBlogPostContentStats('{not json')).toEqual({
      readingTime: 0,
      wordCount: 0,
    });
  });
});
