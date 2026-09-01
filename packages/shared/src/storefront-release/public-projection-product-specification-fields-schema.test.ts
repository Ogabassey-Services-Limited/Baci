import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSpecificationFieldsSchema } from './public-projection-product-specification-fields-schema';

describe('StorefrontPublicProductSpecificationFieldsSchema', () => {
  it('bounds sections and canonicalizes key-spec ordering', () => {
    const parsed = StorefrontPublicProductSpecificationFieldsSchema.parse({
      productKeySpecs: { storage_gb: 256, chipset: 'Snapdragon 8' },
      specifications: [
        {
          category: 'Display',
          items: [{ label: 'Size', value: '6.7 inches' }],
        },
      ],
    });

    expect(Object.keys(parsed.productKeySpecs ?? {})).toEqual([
      'chipset',
      'storage_gb',
    ]);
  });

  it('rejects unsupported nested key-spec values', () => {
    expect(
      StorefrontPublicProductSpecificationFieldsSchema.safeParse({
        productKeySpecs: { chipset: { name: 'Snapdragon 8' } },
      }).success
    ).toBe(false);
  });
});
