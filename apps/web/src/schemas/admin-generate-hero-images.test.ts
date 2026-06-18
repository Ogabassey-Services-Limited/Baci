import { describe, expect, it } from 'vitest';
import { adminGenerateHeroImagesRequestSchema } from './admin-generate-hero-images';

describe('adminGenerateHeroImagesRequestSchema', () => {
  it('defaults count to 10 when omitted', () => {
    expect(
      adminGenerateHeroImagesRequestSchema.parse({ category: 'electronics' })
    ).toEqual({
      category: 'electronics',
      count: 10,
    });
  });

  it('accepts supported categories and bounded integer counts', () => {
    expect(
      adminGenerateHeroImagesRequestSchema.parse({
        category: 'fashion',
        count: 1,
      })
    ).toEqual({ category: 'fashion', count: 1 });

    expect(
      adminGenerateHeroImagesRequestSchema.parse({
        category: 'other',
        count: 20,
      })
    ).toEqual({ category: 'other', count: 20 });
  });

  it('rejects unsupported categories and invalid counts', () => {
    expect(
      adminGenerateHeroImagesRequestSchema.safeParse({
        category: 'phones',
        count: 10,
      }).success
    ).toBe(false);

    expect(
      adminGenerateHeroImagesRequestSchema.safeParse({
        category: 'electronics',
        count: 0,
      }).success
    ).toBe(false);

    expect(
      adminGenerateHeroImagesRequestSchema.safeParse({
        category: 'electronics',
        count: 21,
      }).success
    ).toBe(false);

    expect(
      adminGenerateHeroImagesRequestSchema.safeParse({
        category: 'electronics',
        count: 1.5,
      }).success
    ).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(adminGenerateHeroImagesRequestSchema.safeParse(null).success).toBe(
      false
    );
  });
});
