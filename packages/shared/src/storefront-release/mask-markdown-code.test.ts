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
});
