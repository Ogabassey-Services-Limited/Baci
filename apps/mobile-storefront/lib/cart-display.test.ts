import {
  resolveCartItemImageUrl,
  resolveColorSwatchValue,
} from './cart-display';

describe('cart-display', () => {
  it('prefers the currently displayed image when resolving cart item images', () => {
    expect(
      resolveCartItemImageUrl({
        displayedImageUrl: 'https://cdn.example.com/displayed.jpg',
        variantImageUrl: 'https://cdn.example.com/variant.jpg',
        fallbackImageUrl: 'https://cdn.example.com/product.jpg',
      })
    ).toBe('https://cdn.example.com/displayed.jpg');
  });

  it('falls back through variant and product images before placeholder', () => {
    expect(
      resolveCartItemImageUrl({
        variantImages: ['https://cdn.example.com/variant-1.jpg'],
        fallbackImageUrl: 'https://cdn.example.com/product.jpg',
      })
    ).toBe('https://cdn.example.com/variant-1.jpg');
  });

  it('returns the fallback image when the variant image array is empty', () => {
    expect(
      resolveCartItemImageUrl({
        variantImages: [],
        fallbackImageUrl: 'https://cdn.example.com/product.jpg',
      })
    ).toBe('https://cdn.example.com/product.jpg');
  });

  it('ignores the temporary placeholder when a real fallback image exists', () => {
    expect(
      resolveCartItemImageUrl({
        displayedImageUrl:
          'https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image',
        fallbackImageUrl: 'https://cdn.example.com/product.jpg',
      })
    ).toBe('https://cdn.example.com/product.jpg');
  });

  it('falls back to the placeholder when no image candidates exist', () => {
    expect(resolveCartItemImageUrl({})).toBe(
      'https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image'
    );
  });

  it('maps named merchant colors to stable swatch values', () => {
    expect(resolveColorSwatchValue('Midnight Black')).toBe('#0d0d0d');
    expect(resolveColorSwatchValue('Blue Titanium')).toBe('#3F4E57');
  });

  it('returns undefined for unknown or overly short color names', () => {
    expect(resolveColorSwatchValue('zz')).toBeUndefined();
    expect(resolveColorSwatchValue('mystery chroma')).toBeUndefined();
  });
});
