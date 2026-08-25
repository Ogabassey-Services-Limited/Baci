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
});
