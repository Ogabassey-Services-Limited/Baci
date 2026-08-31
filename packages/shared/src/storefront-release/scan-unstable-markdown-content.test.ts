import { describe, expect, it } from 'vitest';
import { hasUnstableMarkdownContent } from './scan-unstable-markdown-content';

describe('hasUnstableMarkdownContent', () => {
  it('honors escaped brackets in Markdown image reference labels', () => {
    expect(
      hasUnstableMarkdownContent(
        '![foo\\]bar][id]\n\n[id]: https://cdn.example.test/hero.png'
      )
    ).toBe(true);
  });

  it('ignores links inside inline code and fenced code blocks', () => {
    expect(
      hasUnstableMarkdownContent(
        '``[download](https://example.test/export?token=secret)``\n\n```html\n<img src="https://cdn.example/image.png?token=secret">\n```'
      )
    ).toBe(false);
  });

  it('still rejects a live link outside code', () => {
    expect(
      hasUnstableMarkdownContent(
        '[download](https://example.test/export?token=secret)'
      )
    ).toBe(true);
  });

  it('scans GFM bare autolinks outside code', () => {
    expect(
      hasUnstableMarkdownContent(
        'Visit https://example.test/export?token=secret for the file.'
      )
    ).toBe(true);
  });

  it('ignores bare autolinks inside indented code', () => {
    expect(
      hasUnstableMarkdownContent(
        [
          '    Visit https://example.test/export?token=secret',
          '',
          'Done.',
        ].join('\n')
      )
    ).toBe(false);
  });
});
