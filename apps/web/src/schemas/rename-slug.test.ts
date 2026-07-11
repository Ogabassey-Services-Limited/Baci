import { describe, expect, it } from 'vitest';
import { renameSlugSchema, STORE_SLUG_PATTERN } from './rename-slug';

describe('renameSlugSchema', () => {
  it('accepts a valid lowercase, hyphenated slug', () => {
    expect(
      renameSlugSchema.safeParse({ new_slug: 'my-store-123' }).success
    ).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = renameSlugSchema.safeParse({ new_slug: '  my-store  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.new_slug).toBe('my-store');
    }
  });

  it('rejects fewer than 3 characters', () => {
    expect(renameSlugSchema.safeParse({ new_slug: 'ab' }).success).toBe(false);
  });

  it('rejects more than 63 characters', () => {
    expect(
      renameSlugSchema.safeParse({ new_slug: 'a'.repeat(64) }).success
    ).toBe(false);
  });

  it('accepts a slug at the minimum length (3)', () => {
    expect(renameSlugSchema.safeParse({ new_slug: 'abc' }).success).toBe(true);
  });

  it('accepts a slug at the maximum length (63)', () => {
    expect(
      renameSlugSchema.safeParse({ new_slug: 'a'.repeat(63) }).success
    ).toBe(true);
  });

  it('rejects uppercase, spaces, and special characters', () => {
    for (const bad of ['MyStore', 'my store', 'my_store', 'my.store', 'café']) {
      expect(renameSlugSchema.safeParse({ new_slug: bad }).success).toBe(false);
    }
  });

  it('rejects leading or trailing hyphens', () => {
    expect(renameSlugSchema.safeParse({ new_slug: '-store' }).success).toBe(
      false
    );
    expect(renameSlugSchema.safeParse({ new_slug: 'store-' }).success).toBe(
      false
    );
  });

  it('exposes a pattern matching the generate_slug() output shape', () => {
    expect(STORE_SLUG_PATTERN.test('abc')).toBe(true);
    expect(STORE_SLUG_PATTERN.test('a1-b2')).toBe(true);
    expect(STORE_SLUG_PATTERN.test('-a')).toBe(false);
    expect(STORE_SLUG_PATTERN.test('a-')).toBe(false);
    expect(STORE_SLUG_PATTERN.test('a b')).toBe(false);
  });
});
