import { resolveSafeImageUri } from './safe-image-uri';

describe('resolveSafeImageUri', () => {
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
