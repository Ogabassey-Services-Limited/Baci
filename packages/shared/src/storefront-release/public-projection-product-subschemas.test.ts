import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSubschemas } from './public-projection-product-subschemas';

describe('StorefrontPublicProductSubschemas', () => {
  it('canonicalizes conditions and variant attributes', () => {
    const result = StorefrontPublicProductSubschemas.variant.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Phone',
      priceMinor: 100,
      available: true,
      displayQuantityLimit: null,
      condition: 'open_box',
      attributes: { 'Storage-Size': '128GB' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.condition).toBe('open_box');
      expect(result.data.attributes).toEqual({ storage_size: '128GB' });
    }
  });

  it('rejects duplicate canonical condition summaries', () => {
    const result =
      StorefrontPublicProductSubschemas.availableConditions.safeParse([
        'new',
        'new',
      ]);

    expect(result.success).toBe(false);
  });
});
