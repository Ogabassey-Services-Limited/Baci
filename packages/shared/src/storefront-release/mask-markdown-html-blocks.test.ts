import { describe, expect, it } from 'vitest';
import { maskMarkdownHtmlBlocks } from './mask-markdown-html-blocks';

describe('maskMarkdownHtmlBlocks', () => {
  it('preserves line breaks while masking comments and raw tags', () => {
    const content =
      '<!-- ![x](https://cdn.example/x.png) -->\n<pre>![y](https://cdn.example/y.png)</pre>';
    const masked = maskMarkdownHtmlBlocks(content);

    expect(masked).not.toContain('https://cdn.example/x.png');
    expect(masked).not.toContain('https://cdn.example/y.png');
    expect(masked.split('\n')).toHaveLength(2);
  });

  it('does not mask inline HTML that Marked parses as Markdown', () => {
    const content = 'text <div>![x](https://cdn.example/x.png)</div>';

    expect(maskMarkdownHtmlBlocks(content)).toBe(content);
  });
});
