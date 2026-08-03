import { describe, expect, it } from 'vitest';
import { extractSqlFunction } from './extract-sql-function';

describe('extractSqlFunction', () => {
  it('extracts a function through its dollar-quoted terminator', () => {
    const migrationSql = [
      'CREATE OR REPLACE FUNCTION private.example()',
      'RETURNS void',
      'AS $$',
      'BEGIN',
      '  RETURN;',
      'END;',
      '$$;',
      'CREATE TABLE private.after_function ();',
    ].join('\n');

    expect(extractSqlFunction(migrationSql, 'private.example()')).toBe(
      [
        'CREATE OR REPLACE FUNCTION private.example()',
        'RETURNS void',
        'AS $$',
        'BEGIN',
        '  RETURN;',
        'END;',
        '$$;',
      ].join('\n')
    );
  });

  it('returns an empty string when the function or terminator is missing', () => {
    expect(
      extractSqlFunction('CREATE TABLE private.example ();', 'example()')
    ).toBe('');
    expect(
      extractSqlFunction(
        'CREATE OR REPLACE FUNCTION private.example()\nAS $$\nBEGIN;',
        'private.example()'
      )
    ).toBe('');
  });
});
