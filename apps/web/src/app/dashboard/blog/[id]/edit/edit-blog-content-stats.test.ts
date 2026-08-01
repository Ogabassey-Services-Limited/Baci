import { describe, expect, it } from 'vitest';
import { getBlogContentStats } from './edit-blog-content-stats';

describe('getBlogContentStats', () => {
  it('counts nested editor text and rounds a partial reading minute up', () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One two' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
      ],
    });

    expect(getBlogContentStats(content)).toEqual({
      wordCount: 3,
      readingTime: 1,
    });
  });

  it('returns empty statistics for malformed stored editor content', () => {
    expect(getBlogContentStats('{not-json')).toEqual({
      wordCount: 0,
      readingTime: 0,
    });
  });

  it('joins adjacent inline text and punctuation without inventing word boundaries', () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hel' },
            { type: 'text', text: 'lo' },
            { type: 'text', text: ',' },
            { type: 'text', text: ' world' },
          ],
        },
      ],
    });

    expect(getBlogContentStats(content)).toEqual({
      wordCount: 2,
      readingTime: 1,
    });
  });
});
