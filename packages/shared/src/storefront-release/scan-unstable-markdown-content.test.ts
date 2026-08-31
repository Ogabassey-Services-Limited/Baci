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

  it('scans escaped brackets in reference definitions', () => {
    expect(
      hasUnstableMarkdownContent(
        '![foo\\]bar]\n\n[foo\\]bar]: https://cdn.example.test/a.png'
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

  it('does not let an unmatched link label consume a later image token', () => {
    expect(
      hasUnstableMarkdownContent(
        '[ broken\n![x](https://cdn.example.test/a.png)'
      )
    ).toBe(true);
  });

  it('rescans images nested in a balanced non-link label', () => {
    expect(
      hasUnstableMarkdownContent(
        '[broken ![x](https://cdn.example.test/a.png)]'
      )
    ).toBe(true);
  });

  it('treats an escaped image marker as an ordinary safe link', () => {
    expect(
      hasUnstableMarkdownContent('\\![x](https://example.test/a.png)')
    ).toBe(false);
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

  it('does not mask live links nested in list continuations', () => {
    expect(
      hasUnstableMarkdownContent(
        '- item\n\n    ![x](https://cdn.example.test/a.png)'
      )
    ).toBe(true);
  });

  it('does not treat a reference definition inside the preceding paragraph as an image', () => {
    expect(
      hasUnstableMarkdownContent(
        '![diagram][ref]\n[ref]: https://cdn.example.test/a.png'
      )
    ).toBe(false);
  });

  it('decodes structural named entities before validating destinations', () => {
    expect(hasUnstableMarkdownContent('[admin](/foo&sol;..&sol;admin)')).toBe(
      true
    );
  });
});
