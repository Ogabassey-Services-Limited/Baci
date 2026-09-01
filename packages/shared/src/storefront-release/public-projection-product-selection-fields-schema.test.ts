import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSelectionFieldsSchema } from './public-projection-product-selection-fields-schema';

describe('StorefrontPublicProductSelectionFieldsSchema', () => {
  it('preserves parent selection metadata for incomplete variant rows', () => {
    const fields = {
      attributeAxes: ['platform', 'storage'],
      storageOptions: ['128GB', '256GB'],
      variantAttributes: { platform: ['Android', 'iOS'], storage: ['256GB'] },
    } as const;

    expect(StorefrontPublicProductSelectionFieldsSchema.parse(fields)).toEqual(
      fields
    );
  });

  it('rejects duplicate axes and unbounded option lists', () => {
    expect(
      StorefrontPublicProductSelectionFieldsSchema.safeParse({
        attributeAxes: ['storage', 'storage'],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSelectionFieldsSchema.safeParse({
        storageOptions: Array.from({ length: 65 }, (_, index) => `${index}`),
      }).success
    ).toBe(false);
  });

  it('canonicalizes parent axes and rejects reserved or colliding names', () => {
    const parsed = StorefrontPublicProductSelectionFieldsSchema.parse({
      attributeAxes: ['Storage-size', 'Color'],
      variantAttributes: {
        Color: ['Red'],
        'storage-size': ['128GB'],
      },
    });

    expect(parsed.attributeAxes).toEqual(['storage_size', 'color']);
    expect(parsed.variantAttributes).toEqual({
      Color: ['Red'],
      'storage-size': ['128GB'],
    });
    expect(
      StorefrontPublicProductSelectionFieldsSchema.safeParse({
        attributeAxes: ['Color', 'color'],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSelectionFieldsSchema.safeParse({
        variantAttributes: { condition: ['new'] },
      }).success
    ).toBe(false);
  });
});
