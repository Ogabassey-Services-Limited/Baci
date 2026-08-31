import { describe, expect, it } from 'vitest';
import { maskMarkdownCode } from './mask-markdown-code';

describe('maskMarkdownCode', () => {
  it('preserves line structure while masking fenced and inline code', () => {
    const masked = maskMarkdownCode(
      'before `code`\n```html\n<img>\n```\nafter'
    );
    expect(masked.split('\n')).toHaveLength(5);
    expect(masked).toContain('before       ');
    expect(masked).toMatch(/\n\s+\n\s+\n\s+\n/);
    expect(masked.endsWith('after')).toBe(true);
  });

  it('masks every line in an unclosed fenced block', () => {
    const masked = maskMarkdownCode(
      ['```text', 'first line', 'second line', 'third line'].join('\n')
    );

    expect(masked).toBe(
      ['       ', '          ', '           ', '          '].join('\n')
    );
  });

  it('masks standard indented Markdown code blocks', () => {
    const codeLine = '    [request](https://example.test/export?token=value)';
    const masked = maskMarkdownCode(['before', codeLine, 'after'].join('\n'));

    expect(masked.split('\n')).toEqual([
      'before',
      ' '.repeat(codeLine.length),
      'after',
    ]);
  });

  it('keeps four-space list continuations as live Markdown', () => {
    const markdown = '- item\n\n    ![x](https://cdn.example.test/a.png)';

    expect(maskMarkdownCode(markdown)).toContain(
      '![x](https://cdn.example.test/a.png)'
    );
  });

  it('masks code blocks nested deeply inside list items', () => {
    const codeLine = '        ![x](https://cdn.example.test/a.png)';
    const masked = maskMarkdownCode(`- item\n\n${codeLine}`);

    expect(masked.split('\n')[2]).toBe(' '.repeat(codeLine.length));
  });

  it('masks indented code inside blockquotes', () => {
    const markdown = '>     [request](https://example.test/export?token=value)';

    expect(maskMarkdownCode(markdown)).toBe(' '.repeat(markdown.length));
  });

  it('masks fenced code whose closing fence is inside the same blockquote', () => {
    const markdown = [
      '> ```html',
      '> <img src="https://example.test/x">',
      '> ```',
      '',
      '![x](https://example.test/x.png)',
    ].join('\n');

    const masked = maskMarkdownCode(markdown);

    expect(masked).not.toContain('<img src="https://example.test/x">');
    expect(masked).toContain('![x](https://example.test/x.png)');
  });

  it('stops an unclosed blockquote fence when the quote container ends', () => {
    const markdown = [
      '> ```html',
      '> <img src="https://example.test/x">',
      '![x](https://cdn.example.test/live.png)',
    ].join('\n');

    const masked = maskMarkdownCode(markdown);

    expect(masked).toContain('![x](https://cdn.example.test/live.png)');
  });

  it('stops an unclosed list fence when the list item container ends', () => {
    const markdown = [
      '- ```html',
      '  <img src="https://example.test/x">',
      '![x](https://cdn.example.test/live.png)',
    ].join('\n');

    const masked = maskMarkdownCode(markdown);

    expect(masked).toContain('![x](https://cdn.example.test/live.png)');
  });

  it('does not mask an image after an inline delimiter with a mismatched run', () => {
    const markdown = '` ![x](https://cdn.example.test/a.png) ``';

    expect(maskMarkdownCode(markdown)).toBe(markdown);
  });

  it('closes an inline code span after a backslash inside the span', () => {
    const markdown = '`path\\\\file` ![x](https://example.test/x.png)';

    expect(maskMarkdownCode(markdown)).toContain(
      '![x](https://example.test/x.png)'
    );
  });

  it('treats a backtick after an even backslash run as a code opener', () => {
    const markdown = 'before \\\\`code` ![x](https://example.test/x.png)';

    const masked = maskMarkdownCode(markdown);
    expect(masked).not.toContain('`code`');
    expect(masked).toContain('![x](https://example.test/x.png)');
  });
});
