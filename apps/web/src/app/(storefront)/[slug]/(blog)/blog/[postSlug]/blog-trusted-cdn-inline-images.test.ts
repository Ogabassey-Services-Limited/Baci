import { describe, expect, it } from 'vitest';
import { wrapTrustedCdnInlineImagesInPicture } from './blog-trusted-cdn-inline-images';

const CDN =
  'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png';

describe('wrapTrustedCdnInlineImagesInPicture', () => {
  it('wraps trusted CDN inline images with responsive AVIF/WebP sources', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="Speaker" />`
    );

    expect(out).toContain('<picture>');
    expect(out).toContain('type="image/avif"');
    expect(out).toContain('type="image/webp"');
    expect(out).toContain('srcset="https://cdn.ogabassey.com/image/width=384');
    expect(out).toContain('loading="eager"');
    expect(out).toContain('fetchpriority="high"');
  });

  it('preserves source dimensions and lazy-loads non-priority images', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" width="900" height="1200" alt="Portrait" />`,
      { prioritizeFirstBodyImage: false }
    );

    expect(out).toContain('width="900"');
    expect(out).toContain('height="1200"');
    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain('fetchpriority="high"');
  });

  it('leaves untrusted images untouched', () => {
    const html = '<img src="https://example.com/inline-1.png" alt="x" />';

    expect(wrapTrustedCdnInlineImagesInPicture(html)).toBe(html);
  });
});
