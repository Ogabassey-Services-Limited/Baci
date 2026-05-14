import { describe, expect, it } from 'vitest';
import { getOgabasseyImagePreloadType } from './ogabassey-image-preload-type';

describe('getOgabasseyImagePreloadType', () => {
  it('infers types from CDN transform formats and file extensions', () => {
    expect(
      getOgabasseyImagePreloadType(
        '/image/width=640,quality=70,format=webp/p.png'
      )
    ).toBe('image/webp');
    expect(getOgabasseyImagePreloadType('/image/p.png?format=avif')).toBe(
      'image/avif'
    );
    expect(getOgabasseyImagePreloadType('/media/product.jpg')).toBe(
      'image/jpeg'
    );
  });

  it('returns undefined when the URL has no recognized image format', () => {
    expect(getOgabasseyImagePreloadType('/image/product')).toBeUndefined();
  });
});
