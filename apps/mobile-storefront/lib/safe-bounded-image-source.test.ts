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
});
