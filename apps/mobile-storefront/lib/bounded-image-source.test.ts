import { createBoundedImageSource } from './bounded-image-source';

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
});
