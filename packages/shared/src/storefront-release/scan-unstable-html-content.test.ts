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
        `<p><a href="https://example.test/about">About</a></p><img src="${media}">`
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
});
