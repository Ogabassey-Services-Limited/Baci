import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSelectionFieldsSchema } from './public-projection-product-selection-fields-schema';

describe('StorefrontPublicProductSelectionFieldsSchema', () => {
  it('preserves parent selection metadata for incomplete variant rows', () => {
    const fields = {
      attributeAxes: ['Platform', 'storage'],
      storageOptions: ['128GB', '256GB'],
      variantAttributes: { Platform: ['Android', 'iOS'], storage: ['256GB'] },
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
});
