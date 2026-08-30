import { createSafeBoundedImageSource } from './safe-bounded-image-source';

describe('createSafeBoundedImageSource', () => {
  it('rewrites managed AVIF product assets to a bounded static JPEG', () => {
    expect(
      createSafeBoundedImageSource({
        height: 100,
        pixelRatio: 2,
        uri: 'https://cdn.ogabassey.com/core-assets/products/phone.avif',
        width: 120,
      })
    ).toEqual({
      height: 200,
      uri: 'https://cdn.ogabassey.com/image/width=240,height=200,quality=75,format=jpeg/core-assets/products/phone.avif',
      width: 240,
    });
  });

  it('forwards cover fitting to managed CDN transforms', () => {
    expect(
      createSafeBoundedImageSource({
        fit: 'cover',
        height: 100,
        uri: 'https://cdn.ogabassey.com/core-assets/products/phone.avif',
        width: 120,
      }).uri
    ).toBe(
      'https://cdn.ogabassey.com/image/width=240,height=200,quality=75,format=jpeg,fit=cover/core-assets/products/phone.avif'
    );
  });
});
