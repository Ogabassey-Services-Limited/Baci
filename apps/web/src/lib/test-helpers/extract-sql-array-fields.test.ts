import { describe, expect, it } from 'vitest';
import { extractSqlArrayFields } from './extract-sql-array-fields';

describe('extractSqlArrayFields', () => {
  it('extracts quoted fields from the requested declaration', () => {
    const triggerSql = [
      'v_exact_fields text[] := ARRAY[',
      "  'first_field', 'second_field'",
      ']::text[];',
      'v_presence_fields text[] := ARRAY[',
      "  'secret_field'",
      ']::text[];',
    ].join('\n');

    expect(extractSqlArrayFields(triggerSql, 'exact')).toEqual([
      'first_field',
      'second_field',
    ]);
    expect(extractSqlArrayFields(triggerSql, 'presence')).toEqual([
      'secret_field',
    ]);
  });

  it('returns an empty list when the declaration is missing or incomplete', () => {
    expect(
      extractSqlArrayFields('v_exact_fields text[] := ARRAY[];', 'exact')
    ).toEqual([]);
    expect(
      extractSqlArrayFields(
        "v_exact_fields text[] := ARRAY['first_field']",
        'exact'
      )
    ).toEqual([]);
  });
});
