import { transformProduct } from '@/lib/storefront-product-transform';

describe('transformProduct', () => {
  const baseProduct = {
    id: '11111111-1111-4111-8111-111111111111',
    merchant_id: '22222222-2222-4222-8222-222222222222',
    name: 'Galaxy Z Fold 6',
    slug: 'galaxy-z-fold-6',
    price: 900000,
    images: ['https://cdn.example.com/fold.png'],
  };

  it('sanitizes product descriptions', () => {
    const product = transformProduct({
      ...baseProduct,
      description: '<script>alert(1)</script><p>Foldable</p>',
    });

    expect(product.description).toBe('<p>Foldable</p>');
  });

  it('normalizes colors and color-specific images', () => {
    const product = transformProduct({
      ...baseProduct,
      colors: [
        ' Black ',
        { name: ' White ', value: ' #ffffff ' },
        { name: ' White ', value: ' #ffffff ' },
        '   ',
      ],
      color_images: {
        ' Black ': [' https://cdn.example.com/fold-black.png ', '   '],
        '': ['https://cdn.example.com/ignore.png'],
      },
    });

    expect(product.colors).toEqual(['Black', { name: 'White', value: '#ffffff' }]);
    expect(product.color_images).toEqual({
      Black: ['https://cdn.example.com/fold-black.png'],
    });
  });

  it('normalizes specifications', () => {
    const product = transformProduct({
      ...baseProduct,
      specifications: {
        ' Memory ': ' 12GB ',
        '': 'Ignore',
      },
    });

    expect(product.specifications).toEqual({
      Memory: '12GB',
    });
  });

  it('sanitizes offer notes', () => {
    const product = transformProduct({
      ...baseProduct,
      offers: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          condition: 'new',
          price: 900000,
          images: ['https://cdn.example.com/fold-offer.png'],
          condition_notes: '<img src=x onerror=alert(1)><p>Mint</p>',
        },
      ],
    });

    expect(product.offers?.[0]?.condition_notes).toBe('<img src=x><p>Mint</p>');
  });

  it('rejects invalid offer grades', () => {
    const product = transformProduct({
      ...baseProduct,
      offers: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          condition: 'new',
          price: 900000,
          images: ['https://cdn.example.com/fold-offer.png'],
          condition_notes: '<img src=x onerror=alert(1)><p>Mint</p>',
          grade: 'z',
        },
      ],
    });

    expect(product.offers?.[0]?.grade).toBeUndefined();
  });
});
