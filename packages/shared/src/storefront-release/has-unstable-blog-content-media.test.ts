import { describe, expect, it } from 'vitest';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';

describe('hasUnstableBlogContentMedia', () => {
  it('rejects signed inline image URLs', () => {
    expect(
      hasUnstableBlogContentMedia(
        JSON.stringify({
          attrs: { src: 'https://cdn.example/image.png?token=secret' },
          type: 'image',
        })
      )
    ).toBe(true);
  });

  it('accepts content-addressed inline image paths and plain text', () => {
    expect(
      hasUnstableBlogContentMedia(
        JSON.stringify({
          attrs: { src: `/release-assets/${'a'.repeat(64)}.png` },
          type: 'image',
        })
      )
    ).toBe(false);
    expect(hasUnstableBlogContentMedia('Published guide content')).toBe(false);
  });

  it('rejects signed image sources in persisted HTML content', () => {
    expect(
      hasUnstableBlogContentMedia(
        '<p>Guide</p><img src="https://cdn.example/image.png?token=secret">'
      )
    ).toBe(true);
    expect(
      hasUnstableBlogContentMedia(
        `<img alt="Guide" src="/release-assets/${'b'.repeat(64)}.webp">`
      )
    ).toBe(false);
  });

  it('rejects signed responsive image candidates in persisted HTML', () => {
    const stable = `/release-assets/${'c'.repeat(64)}.webp`;
    expect(
      hasUnstableBlogContentMedia(
        `<picture><source srcset="${stable} 1x, https://cdn.example/image.png?token=secret 2x"><img src="${stable}"></picture>`
      )
    ).toBe(true);
  });

  it('rejects query-bearing TipTap links', () => {
    expect(
      hasUnstableBlogContentMedia(
        JSON.stringify({
          marks: [
            {
              attrs: { href: 'https://example.test/export?token=secret' },
              type: 'link',
            },
          ],
          text: 'Download',
          type: 'text',
        })
      )
    ).toBe(true);
  });

  it('rejects query-bearing links in persisted HTML', () => {
    expect(
      hasUnstableBlogContentMedia(
        '<p><a href="https://example.test/export?token=secret">Download</a></p>'
      )
    ).toBe(true);
  });

  it.each([
    '&#x3f;',
    '&#63;',
    '&quest;',
  ])('rejects HTML links whose query marker is encoded as %s', (queryMarker) => {
    expect(
      hasUnstableBlogContentMedia(
        `<a href="https://example.test/export${queryMarker}token=secret">Download</a>`
      )
    ).toBe(true);
  });

  it.each([
    '[Download](https://example.test/export?token=secret)',
    '![Image](https://cdn.test/image.png?token=secret)',
    '[Download][export]\n\n[export]: https://example.test/export?token=secret',
    '<https://example.test/export?token=secret>',
    '[Download](https://example.test/a(b)?token=secret)',
  ])('rejects query-bearing Markdown destinations in %s', (content) => {
    expect(hasUnstableBlogContentMedia(content)).toBe(true);
  });

  it('requires Markdown image references to use immutable release media', () => {
    for (const content of [
      '![Product][hero]\n\n[hero]: https://cdn.example.test/hero.png',
      '![Product][]\n\n[Product]: https://cdn.example.test/hero.png',
      '![Product]\n\n[Product]: https://cdn.example.test/hero.png',
    ])
      expect(hasUnstableBlogContentMedia(content)).toBe(true);
  });
});
