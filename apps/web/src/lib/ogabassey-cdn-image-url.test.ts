import { describe, expect, it } from 'vitest';
import {
  buildOgabasseyCdnFallbackImageLoaderUrl,
  buildOgabasseyCdnImageLoaderUrl,
  isOgabasseyCdnImageUrl,
  normalizeOgabasseyCdnImageUrl,
  resolveOgabasseyCdnFallbackFormat,
  rewriteOgabasseyTransformUrlFormat,
} from './ogabassey-cdn-image-url';

const CDN = 'https://cdn.ogabassey.com';

describe('resolveOgabasseyCdnFallbackFormat', () => {
  it('returns png for .png source paths', () => {
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.png')
    ).toBe('png');
  });

  it('returns png for .PNG source paths case-insensitively', () => {
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.PNG')
    ).toBe('png');
  });

  it('returns jpeg for jpg/jpeg/webp/avif and extensionless source paths', () => {
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.jpg')
    ).toBe('jpeg');
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.jpeg')
    ).toBe('jpeg');
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.webp')
    ).toBe('jpeg');
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone.avif')
    ).toBe('jpeg');
    expect(
      resolveOgabasseyCdnFallbackFormat('/core-assets/products/phone')
    ).toBe('jpeg');
  });
});

describe('buildOgabasseyCdnImageLoaderUrl', () => {
  it('defaults to format=auto so unmigrated next/image callers retain AVIF negotiation', () => {
    const url = buildOgabasseyCdnImageLoaderUrl(
      `${CDN}/core-assets/products/phone.jpg`,
      750,
      75
    );

    expect(url).toBe(
      `${CDN}/image/width=750,quality=75,format=auto/core-assets/products/phone.jpg`
    );
  });

  it('builds a jpeg fallback URL for a jpg source when requested explicitly', () => {
    const url = buildOgabasseyCdnFallbackImageLoaderUrl(
      `${CDN}/core-assets/products/phone.jpg`,
      750,
      75
    );

    expect(url).toBe(
      `${CDN}/image/width=750,quality=75,format=jpeg/core-assets/products/phone.jpg`
    );
    expect(url).not.toContain('format=auto');
  });

  it('builds a png fallback URL for a png source when requested explicitly', () => {
    const url = buildOgabasseyCdnFallbackImageLoaderUrl(
      `${CDN}/core-assets/products/phone.png`,
      750,
      75
    );

    expect(url).toBe(
      `${CDN}/image/width=750,quality=75,format=png/core-assets/products/phone.png`
    );
    expect(url).not.toContain('format=auto');
  });

  it('emits format=avif when explicitly requested', () => {
    const url = buildOgabasseyCdnImageLoaderUrl(
      `${CDN}/core-assets/products/phone.jpg`,
      750,
      75,
      'avif'
    );

    expect(url).toBe(
      `${CDN}/image/width=750,quality=75,format=avif/core-assets/products/phone.jpg`
    );
  });

  it('still honors format=auto as a legacy escape hatch when explicitly passed', () => {
    const url = buildOgabasseyCdnImageLoaderUrl(
      `${CDN}/core-assets/products/phone.jpg`,
      750,
      75,
      'auto'
    );

    expect(url).toBe(
      `${CDN}/image/width=750,quality=75,format=auto/core-assets/products/phone.jpg`
    );
  });
});

describe('rewriteOgabasseyTransformUrlFormat', () => {
  const transformUrl = `${CDN}/image/width=640,quality=80,format=jpeg/core-assets/products/phone.jpg?v=2#frag`;

  it('rewrites the format token while preserving width/quality/path/query/hash', () => {
    const rewritten = rewriteOgabasseyTransformUrlFormat(transformUrl, 'avif');

    expect(rewritten).toBe(
      `${CDN}/image/width=640,quality=80,format=avif/core-assets/products/phone.jpg?v=2#frag`
    );
    // Only the format token differs — swapping it back reproduces the
    // original byte-for-byte, proving width/quality/path/query/hash held.
    expect(rewritten?.replace('format=avif', 'format=jpeg')).toBe(transformUrl);
  });

  it('returns null for a non-OgaBassey host', () => {
    const foreignUrl =
      'https://cdn.example.com/image/width=640,quality=80,format=jpeg/core-assets/products/phone.jpg';

    expect(rewriteOgabasseyTransformUrlFormat(foreignUrl, 'avif')).toBeNull();
  });

  it('returns null for an OgaBassey URL that is not a /image/ transform', () => {
    const plainAssetUrl = `${CDN}/core-assets/products/phone.png`;

    expect(
      rewriteOgabasseyTransformUrlFormat(plainAssetUrl, 'avif')
    ).toBeNull();
  });

  it('returns null for a malformed or relative URL', () => {
    expect(
      rewriteOgabasseyTransformUrlFormat(
        '/image/width=640,quality=80,format=jpeg/core-assets/products/phone.jpg',
        'avif'
      )
    ).toBeNull();
    expect(rewriteOgabasseyTransformUrlFormat('not-a-url', 'avif')).toBeNull();
  });

  it('is a no-op-shaped rewrite when the target format already matches', () => {
    const rewritten = rewriteOgabasseyTransformUrlFormat(transformUrl, 'jpeg');

    expect(rewritten).toBe(transformUrl);
  });

  it('rewrites every format token in malformed duplicated options consistently', () => {
    const duplicatedFormatUrl = `${CDN}/image/format=jpeg,width=640,format=webp,quality=80/core-assets/products/phone.jpg`;

    expect(
      rewriteOgabasseyTransformUrlFormat(duplicatedFormatUrl, 'avif')
    ).toBe(
      `${CDN}/image/format=avif,width=640,format=avif,quality=80/core-assets/products/phone.jpg`
    );
  });
});

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
