import { describe, expect, it } from 'vitest';
import { hasUnstableHtmlContent } from './scan-unstable-html-content';

describe('hasUnstableHtmlContent', () => {
  it('parses media attributes past a quoted angle bracket', () => {
    expect(
      hasUnstableHtmlContent(
        '<img alt=">" src="https://cdn.example/image.png?token=secret">'
      )
    ).toBe(true);
  });

  it('accepts immutable media and query-free links', () => {
    const media = `/release-assets/${'a'.repeat(64)}.png`;
    expect(
      hasUnstableHtmlContent(
        `<p><a href="https://example.com/about">About</a></p><img src="${media}">`
      )
    ).toBe(false);
  });

  it('rejects duplicate URL attributes even when the later value is safe', () => {
    expect(
      hasUnstableHtmlContent(
        '<img src="https://cdn.example/image.png?token=secret" src="/release-assets/image.png">'
      )
    ).toBe(true);
  });

  it('rejects unstable media attributes on non-image HTML elements', () => {
    const cases = [
      '<video poster="https://cdn.example/poster.png?token=secret">',
      '<audio src="https://cdn.example/audio.mp3?token=secret">',
      '<iframe src="https://cdn.example/embed?token=secret">',
      '<embed src="https://cdn.example/file.svg?token=secret">',
      '<object data="https://cdn.example/file.svg?token=secret">',
      '<track src="https://cdn.example/captions.vtt?token=secret">',
    ];
    for (const content of cases)
      expect(hasUnstableHtmlContent(content)).toBe(true);
  });

  it('continues scanning after literal less-than characters', () => {
    expect(
      hasUnstableHtmlContent(
        '2 < 3 <img src="https://cdn.example/image.png?token=secret">'
      )
    ).toBe(true);
  });

  it('decodes named structural entities before validating hrefs', () => {
    expect(
      hasUnstableHtmlContent('<a href="/foo&sol;..&sol;admin">Admin</a>')
    ).toBe(true);
  });

  it('fails closed when a NUL could hide a URL attribute separator', () => {
    expect(
      hasUnstableHtmlContent(
        '<img/\0/src="https://cdn.example.test/image.png">'
      )
    ).toBe(true);
  });

  it('resumes attribute scanning after slash-separated names', () => {
    expect(
      hasUnstableHtmlContent('<img x/src="https://cdn.example.test/image.png">')
    ).toBe(true);
  });

  it.each([
    '<img = src="https://cdn.example.test/image.png">',
    '<img x" src="https://cdn.example.test/image.png">',
  ])('fails closed on malformed HTML attribute prefixes', (content) => {
    expect(hasUnstableHtmlContent(content)).toBe(true);
  });
});
