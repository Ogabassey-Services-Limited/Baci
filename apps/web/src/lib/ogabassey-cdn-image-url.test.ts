import { describe, expect, it } from 'vitest';
import {
  isOgabasseyCdnImageUrl,
  normalizeOgabasseyCdnImageUrl,
} from './ogabassey-cdn-image-url';

describe('ogabassey-cdn-image-url', () => {
  it('detects OgaBassey CDN image URLs', () => {
    expect(
      isOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/core-assets/products/phone.avif'
      )
    ).toBe(true);
    expect(isOgabasseyCdnImageUrl('https://cdn.example.com/phone.avif')).toBe(
      false
    );
  });

  it('returns false for invalid URL strings', () => {
    expect(isOgabasseyCdnImageUrl('')).toBe(false);
    expect(isOgabasseyCdnImageUrl('not-a-url')).toBe(false);
    expect(isOgabasseyCdnImageUrl('https://')).toBe(false);
  });

  it('recognizes OgaBassey CDN URLs even when they are not transformable images', () => {
    expect(
      isOgabasseyCdnImageUrl('https://cdn.ogabassey.com/core-assets/icon.svg')
    ).toBe(true);
    expect(
      isOgabasseyCdnImageUrl('https://cdn.ogabassey.com/core-assets/manual.pdf')
    ).toBe(true);
    expect(
      isOgabasseyCdnImageUrl('https://cdn.ogabassey.com/core-assets/readme.txt')
    ).toBe(true);
  });

  it('unwraps OgaBassey transform URLs to canonical asset paths', () => {
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/image/width=750,quality=75,format=auto/core-assets/products/phone.avif?v=1#main'
      )
    ).toBe(
      'https://cdn.ogabassey.com/core-assets/products/phone.avif?v=1#main'
    );
  });

  it('unwraps transform URLs even when optional transform params are missing', () => {
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/image/width=750/core-assets/products/phone.avif'
      )
    ).toBe('https://cdn.ogabassey.com/core-assets/products/phone.avif');
  });

  it('normalizes unwrapped legacy product transforms to core assets', () => {
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/image/width=750,quality=75,format=auto/products/phone.avif?v=1#main'
      )
    ).toBe(
      'https://cdn.ogabassey.com/core-assets/products/phone.avif?v=1#main'
    );
  });

  it('preserves explicit transform URLs outside managed product and blog assets', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=auto/img.avif?v=1';

    expect(normalizeOgabasseyCdnImageUrl(url)).toBe(url);
  });

  it('leaves malformed transform URLs untouched', () => {
    const transformWithoutAssetPath =
      'https://cdn.ogabassey.com/image/width=750';
    const transformWithoutOptions =
      'https://cdn.ogabassey.com/image//core-assets/products/phone.avif';

    expect(normalizeOgabasseyCdnImageUrl(transformWithoutAssetPath)).toBe(
      transformWithoutAssetPath
    );
    expect(normalizeOgabasseyCdnImageUrl(transformWithoutOptions)).toBe(
      transformWithoutOptions
    );
  });

  it('normalizes legacy product image prefixes to core assets', () => {
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/products/phone.avif'
      )
    ).toBe('https://cdn.ogabassey.com/core-assets/products/phone.avif');
  });

  it('normalizes transformable extensions case-insensitively without changing asset casing', () => {
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/products/phone.AVIF'
      )
    ).toBe('https://cdn.ogabassey.com/core-assets/products/phone.AVIF');
    expect(
      normalizeOgabasseyCdnImageUrl(
        'https://cdn.ogabassey.com/image/width=750/core-assets/products/phone.Jpeg'
      )
    ).toBe('https://cdn.ogabassey.com/core-assets/products/phone.Jpeg');
  });

  it('leaves legacy product URLs with non-transformable extensions untouched', () => {
    const svgUrl = 'https://cdn.ogabassey.com/products/icon.svg';
    const pdfUrl = 'https://cdn.ogabassey.com/products/manual.pdf';
    const textUrl = 'https://cdn.ogabassey.com/products/readme.txt';

    expect(normalizeOgabasseyCdnImageUrl(svgUrl)).toBe(svgUrl);
    expect(normalizeOgabasseyCdnImageUrl(pdfUrl)).toBe(pdfUrl);
    expect(normalizeOgabasseyCdnImageUrl(textUrl)).toBe(textUrl);
  });

  it('leaves unrelated URLs untouched', () => {
    const url = 'https://cdn.example.com/products/phone.avif';

    expect(normalizeOgabasseyCdnImageUrl(url)).toBe(url);
  });

  it('leaves invalid URL strings untouched', () => {
    expect(normalizeOgabasseyCdnImageUrl('')).toBe('');
    expect(normalizeOgabasseyCdnImageUrl('not-a-url')).toBe('not-a-url');
    expect(normalizeOgabasseyCdnImageUrl('https://')).toBe('https://');
  });
});
