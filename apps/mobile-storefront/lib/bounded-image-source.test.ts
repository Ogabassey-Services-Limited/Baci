import {
  createBoundedImageSource,
  createSafeBoundedImageSource,
  resolveSafeImageSource,
  resolveSafeImageUri,
} from './bounded-image-source';

describe('createBoundedImageSource', () => {
  it('provides physical decode dimensions for Android image requests', () => {
    const source = createBoundedImageSource({
      height: 100,
      pixelRatio: 2.625,
      uri: 'https://cdn.example.com/oversized-product.avif',
      width: 120,
    });

    expect(source).toEqual({
      height: 263,
      uri: 'https://cdn.example.com/oversized-product.avif',
      width: 315,
    });
  });

  it('never emits zero-sized decode dimensions', () => {
    expect(
      createBoundedImageSource({
        height: 0,
        pixelRatio: 3,
        uri: 'https://cdn.example.com/product.avif',
        width: 0,
      })
    ).toEqual({
      height: 1,
      uri: 'https://cdn.example.com/product.avif',
      width: 1,
    });
  });

  it('caps physical decode dimensions at the CDN safety limit', () => {
    expect(
      createBoundedImageSource({
        height: 5000,
        pixelRatio: 2,
        uri: 'https://cdn.example.com/product.jpg',
        width: 5000,
      })
    ).toEqual({
      height: 3840,
      uri: 'https://cdn.example.com/product.jpg',
      width: 3840,
    });
  });
});

describe('resolveSafeImageUri', () => {
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

  it('preserves alpha for managed PNG product assets', () => {
    expect(
      resolveSafeImageUri(
        'https://cdn.ogabassey.com/core-assets/products/logo.png?version=2#alpha',
        { height: 48, width: 64 }
      )
    ).toBe(
      'https://cdn.ogabassey.com/image/width=64,height=48,quality=75,format=png/core-assets/products/logo.png?version=2#alpha'
    );
  });

  it('leaves arbitrary Supabase URLs unchanged', () => {
    const uri =
      'https://project.supabase.co/storage/v1/object/public/products/phone.avif';

    expect(resolveSafeImageSource({ height: 120, uri, width: 100 })).toEqual({
      height: 120,
      uri,
      width: 100,
    });
  });

  it('normalizes legacy managed product paths without changing other hosts', () => {
    expect(
      resolveSafeImageUri('https://cdn.ogabassey.com/products/phone.avif', {
        width: 240,
      })
    ).toBe(
      'https://cdn.ogabassey.com/image/width=240,quality=75,format=jpeg/core-assets/products/phone.avif'
    );
    expect(
      resolveSafeImageUri('https://images.example.com/products/phone.avif', {
        width: 240,
      })
    ).toBe('https://images.example.com/products/phone.avif');
  });
});
