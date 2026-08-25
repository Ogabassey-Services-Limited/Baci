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
});
