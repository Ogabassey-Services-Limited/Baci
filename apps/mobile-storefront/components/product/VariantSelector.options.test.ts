import { normalizeVariantOptions } from './VariantSelector.options';

describe('normalizeVariantOptions', () => {
  it('prefers image-driven colors and omits internal attribute axes', () => {
    expect(
      normalizeVariantOptions({
        colors: ['Red'],
        colorImages: { Blue: ['blue.png'] },
        attributes: { storage: ['128GB'], material: ['Steel'] },
      })
    ).toMatchObject({
      hasImageDrivenColors: true,
      normalizedColors: [
        { name: 'Blue', value: '#3B82F6', images: ['blue.png'] },
      ],
      normalizedGenericAttributes: [{ axis: 'material', values: ['Steel'] }],
    });
  });

  it('deduplicates storage and uses matching variant inventory', () => {
    const result = normalizeVariantOptions({
      colors: ['Red'],
      storage: ['128GB', ' 128GB ', '256GB'],
      variants: [
        {
          id: 'variant-128',
          name: 'Red 128GB',
          price: 1000,
          stock_quantity: 2,
          attributes: { storage: '128GB', finish: 'Matte' },
        },
      ],
    });

    expect(result.normalizedStorage).toEqual([
      { value: '128GB', stock: 2 },
      { value: '256GB', stock: undefined },
    ]);
    expect(result.normalizedGenericAttributes).toEqual([
      { axis: 'finish', values: ['Matte'] },
    ]);
  });
});
