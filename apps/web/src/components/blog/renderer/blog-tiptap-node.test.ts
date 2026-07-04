import { describe, expect, it } from 'vitest';
import { extractNodeText } from './blog-tiptap-node';

describe('extractNodeText', () => {
  it('returns the text of a leaf node', () => {
    expect(extractNodeText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('concatenates text across nested children in document order', () => {
    const node = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'hello ' },
        {
          type: 'bold',
          content: [{ type: 'text', text: 'world' }],
        },
      ],
    };

    expect(extractNodeText(node)).toBe('hello world');
  });

  it('returns an empty string for nodes without text or children', () => {
    expect(extractNodeText({ type: 'horizontalRule' })).toBe('');
  });
});
