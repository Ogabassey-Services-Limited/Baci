import { normalizeVariantOptions } from './VariantSelector.options';

describe('normalizeVariantOptions', () => {
  it('prefers image-driven colors and omits internal attribute axes', () => {
    expect(
      normalizeVariantOptions({
        colors: ['Red'],
        colorImages: { Blue: ['blue.png'] },
        attributes: {
          condition: ['used', 'new'],
          material: ['Steel'],
          storage: ['128GB'],
        },
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
          condition: 'used',
          price: 1000,
          stock_quantity: 2,
          attributes: { condition: 'used', finish: 'Matte', storage: '128GB' },
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

  it('omits storage from generic attributes when storage only comes from attributes', () => {
    const result = normalizeVariantOptions({
      attributes: {
        finish: ['Matte'],
        storage: ['128GB'],
      },
    });

    expect(result.normalizedStorage).toEqual([]);
    expect(result.normalizedGenericAttributes).toEqual([
      { axis: 'finish', values: ['Matte'] },
    ]);
  });
});
