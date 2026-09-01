import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductColorGalleriesSchema } from './public-projection-product-color-galleries-schema';

describe('StorefrontPublicProductColorGalleriesSchema', () => {
  it('preserves bounded color-to-media mappings', () => {
    const galleries = [
      {
        color: 'Black',
        mediaIds: ['123e4567-e89b-42d3-a456-426614174090'],
      },
    ];
    expect(
      StorefrontPublicProductColorGalleriesSchema.parse(galleries)
    ).toEqual(galleries);
  });

  it('rejects colors that collide case-insensitively', () => {
    expect(
      StorefrontPublicProductColorGalleriesSchema.safeParse([
        {
          color: 'Black',
          mediaIds: ['123e4567-e89b-42d3-a456-426614174090'],
        },
        {
          color: 'black',
          mediaIds: ['123e4567-e89b-42d3-a456-426614174091'],
        },
      ]).success
    ).toBe(false);
  });

  it('uses locale-independent color identity normalization', () => {
    expect(
      StorefrontPublicProductColorGalleriesSchema.safeParse([
        {
          color: 'I',
          mediaIds: ['123e4567-e89b-42d3-a456-426614174090'],
        },
        {
          color: 'i',
          mediaIds: ['123e4567-e89b-42d3-a456-426614174091'],
        },
      ]).success
    ).toBe(false);
  });
});
