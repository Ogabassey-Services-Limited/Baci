import { describe, expect, it } from 'vitest';
import { enhanceProductImageInputSchema } from './ai-enhance-product-image';

describe('enhanceProductImageInputSchema', () => {
  it.each([
    'png',
    'jpeg',
    'jpg',
    'webp',
    'heic',
    'heif',
  ])('accepts a base64 %s data URI', (format) => {
    const result = enhanceProductImageInputSchema.safeParse({
      photoDataUri: `data:image/${format};base64,aGVsbG8=`,
    });

    expect(result.success).toBe(true);
  });

  it('rejects non data-URI strings such as remote URLs', () => {
    const result = enhanceProductImageInputSchema.safeParse({
      photoDataUri: 'https://example.com/photo.png',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported image formats like svg', () => {
    const result = enhanceProductImageInputSchema.safeParse({
      photoDataUri: 'data:image/svg+xml;base64,aGVsbG8=',
    });

    expect(result.success).toBe(false);
  });

  it('rejects data URIs without a base64 marker', () => {
    const result = enhanceProductImageInputSchema.safeParse({
      photoDataUri: 'data:image/png,plain-text-payload',
    });

    expect(result.success).toBe(false);
  });

  it('rejects payloads above the size cap', () => {
    const oversized = `data:image/png;base64,${'A'.repeat(11_500_001)}`;

    const result = enhanceProductImageInputSchema.safeParse({
      photoDataUri: oversized,
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing or non-string photoDataUri values', () => {
    expect(enhanceProductImageInputSchema.safeParse({}).success).toBe(false);
    expect(
      enhanceProductImageInputSchema.safeParse({ photoDataUri: 42 }).success
    ).toBe(false);
  });
});
