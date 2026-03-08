import { describe, expect, it } from 'vitest';
import { builderCreateSchema, builderPublishSchema } from './builder';

describe('builderCreateSchema', () => {
  it('accepts a valid builder create payload', () => {
    const result = builderCreateSchema.safeParse({
      slug: 'home',
      config: { content: [] },
      name: 'Homepage',
      seo: { title: 'Home' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing config payloads', () => {
    const result = builderCreateSchema.safeParse({
      slug: 'home',
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-object config payloads', () => {
    const result = builderCreateSchema.safeParse({
      slug: 'home',
      config: 'not-an-object',
    });

    expect(result.success).toBe(false);
  });
});

describe('builderPublishSchema', () => {
  it('accepts a valid publish payload', () => {
    const result = builderPublishSchema.safeParse({
      slug: 'home',
    });

    expect(result.success).toBe(true);
  });

  it('rejects blank slugs', () => {
    const result = builderPublishSchema.safeParse({
      slug: '   ',
    });

    expect(result.success).toBe(false);
  });
});
