import { describe, expect, it } from 'vitest';
import { sqlWritesProductDescription } from './product-description-writer-sql-matcher';

describe('sqlWritesProductDescription', () => {
  it('detects quoted and unqualified product table identifiers', () => {
    expect(
      sqlWritesProductDescription(
        'UPDATE "public"."products" SET "description" = \'quoted\';'
      )
    ).toBe(true);
    expect(
      sqlWritesProductDescription(
        "INSERT INTO products (description) VALUES ('unqualified');"
      )
    ).toBe(true);
  });

  it('does not classify unrelated tables as product description writers', () => {
    expect(
      sqlWritesProductDescription(
        "UPDATE public.categories SET description = 'category';"
      )
    ).toBe(false);
  });
});
