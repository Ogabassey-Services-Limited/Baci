import { describe, expect, it } from 'vitest';
import { categoryIdParamSchema } from './category-id-param';

describe('categoryIdParamSchema', () => {
  it('accepts a UUID', () => {
    expect(
      categoryIdParamSchema.safeParse('22222222-2222-4222-8222-222222222222')
        .success
    ).toBe(true);
  });

  it.each([
    ['a plain word', 'phones'],
    ['an empty string', ''],
    ['a truncated UUID', '22222222-2222-4222-8222'],
    ['a SQL-ish payload', "1' OR '1'='1"],
  ])('rejects %s so the route answers 400 rather than 22P02/500', (_l, id) => {
    expect(categoryIdParamSchema.safeParse(id).success).toBe(false);
  });
});
