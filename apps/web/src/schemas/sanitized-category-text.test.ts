import { describe, expect, it } from 'vitest';
import {
  requiredCategoryText,
  sanitizedCategoryText,
} from './sanitized-category-text';

describe('sanitizedCategoryText', () => {
  it('returns the sanitized value, not the raw one', () => {
    const result = sanitizedCategoryText(160).safeParse(
      '<script>alert(1)</script>Phones'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('<script>');
      expect(result.data).toContain('Phones');
    }
  });

  it('trims what sanitization leaves behind', () => {
    const result = sanitizedCategoryText(160).safeParse('  <b>Phones</b>  ');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Phones');
  });

  it('rejects input longer than the maximum', () => {
    expect(sanitizedCategoryText(10).safeParse('a'.repeat(11)).success).toBe(
      false
    );
  });

  it('checks the stored text length after removing markup', () => {
    const result = sanitizedCategoryText(6).safeParse(
      '<div><span>Phones</span></div>'
    );

    expect(result).toMatchObject({ success: true, data: 'Phones' });
  });

  it('allows an empty result — description may legitimately be blank', () => {
    expect(sanitizedCategoryText(2000).safeParse('<b></b>').success).toBe(true);
  });
});

describe('requiredCategoryText', () => {
  it('accepts ordinary text', () => {
    const result = requiredCategoryText(160).safeParse('Phones');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Phones');
  });

  describe('bugfix: a markup-only name reached the insert as an empty string', () => {
    it.each([
      ['an empty tag pair', '<b></b>'],
      ['nested empty tags', '<div><span></span></div>'],
      ['a lone tag', '<br>'],
    ])('rejects %s instead of storing a blank name', (_label, value) => {
      // `categories.name` is only NOT NULL, so Postgres accepted '' happily and
      // the merchant got an unnamed category. `.min(1)` on the RAW value could
      // not catch this because sanitization happened afterwards, in the route.
      expect(requiredCategoryText(160).safeParse(value).success).toBe(false);
    });

    it('rejects whitespace that survives sanitization', () => {
      expect(requiredCategoryText(160).safeParse('   ').success).toBe(false);
    });
  });
});
