import { describe, expect, it } from 'vitest';
import {
  internalSlugSetParamsSchema,
  internalSlugSetQuerySchema,
} from '@/schemas/internal-slug-set-route';

describe('internalSlugSetParamsSchema', () => {
  it('accepts a non-empty identifier and trims it', () => {
    const result = internalSlugSetParamsSchema.safeParse({
      identifier: '  ogabassey.com  ',
    });
    expect(result.success).toBe(true);
    expect(result.data?.identifier).toBe('ogabassey.com');
  });

  it('rejects a missing identifier', () => {
    expect(internalSlugSetParamsSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a blank identifier', () => {
    expect(
      internalSlugSetParamsSchema.safeParse({ identifier: '   ' }).success
    ).toBe(false);
  });

  it('rejects an over-long identifier (>255)', () => {
    expect(
      internalSlugSetParamsSchema.safeParse({ identifier: 'a'.repeat(256) })
        .success
    ).toBe(false);
  });
});

describe('internalSlugSetQuerySchema', () => {
  it('accepts a non-empty slug and trims it', () => {
    const result = internalSlugSetQuerySchema.safeParse({
      slug: ' iphone-15 ',
    });
    expect(result.success).toBe(true);
    expect(result.data?.slug).toBe('iphone-15');
  });

  it('rejects a null/missing slug', () => {
    expect(internalSlugSetQuerySchema.safeParse({ slug: null }).success).toBe(
      false
    );
    expect(internalSlugSetQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects a blank slug', () => {
    expect(internalSlugSetQuerySchema.safeParse({ slug: '  ' }).success).toBe(
      false
    );
  });
});
