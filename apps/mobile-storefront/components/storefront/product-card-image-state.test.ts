import { getProductImageSource } from './product-card-image-state';

describe('bugfix: product-card image fallback', () => {
  it('does not return a remote fallback source after image load failure', () => {
    const source = getProductImageSource(
      'https://cdn.ogabassey.com/core-assets/products/missing-image.avif',
      true
    );

    expect(source).toBeNull();
  });

  it('returns null when image url is blank', () => {
    const source = getProductImageSource('   ', false);

    expect(source).toBeNull();
  });

  it('returns null when image url is null', () => {
    expect(getProductImageSource(null, false)).toBeNull();
  });

  it('returns null when image url is undefined', () => {
    expect(getProductImageSource(undefined, false)).toBeNull();
  });

  it('returns null when image url is empty string', () => {
    expect(getProductImageSource('', false)).toBeNull();
  });

  it('returns a normalized uri when image url is valid and no error happened', () => {
    const source = getProductImageSource(' https://example.com/p.jpg ', false);

    expect(source).toEqual({ uri: 'https://example.com/p.jpg' });
  });
});
