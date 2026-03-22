import { describe, expect, it } from 'vitest';
import { parseCsvText } from '@/lib/imports/csv/parse-csv';

describe('parseCsvText', () => {
  it('returns headers and rows for simple CSV content', () => {
    const result = parseCsvText('name,price\nPhone,1000\nCase,100');

    expect(result.headers).toEqual(['name', 'price']);
    expect(result.rows).toEqual([
      { name: 'Phone', price: '1000' },
      { name: 'Case', price: '100' },
    ]);
  });

  it('supports quoted commas and escaped quotes', () => {
    const result = parseCsvText(
      'title,description\n"Phone, Max","Says ""hello"""'
    );

    expect(result.rows).toEqual([
      { title: 'Phone, Max', description: 'Says "hello"' },
    ]);
  });

  it('supports multiline quoted values', () => {
    const result = parseCsvText(
      'title,description\nPhone,"Line one\nLine two"\nCase,"Single line"'
    );

    expect(result.rows[0]).toEqual({
      title: 'Phone',
      description: 'Line one\nLine two',
    });
    expect(result.rows[1]).toEqual({
      title: 'Case',
      description: 'Single line',
    });
  });

  it('ignores empty trailing lines', () => {
    const result = parseCsvText('name,price\nPhone,1000\n\n');

    expect(result.rows).toHaveLength(1);
  });

  it('returns empty headers and rows for empty CSV input', () => {
    const result = parseCsvText('');

    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('supports headers-only CSV input', () => {
    const result = parseCsvText('name,price');

    expect(result.headers).toEqual(['name', 'price']);
    expect(result.rows).toEqual([]);
  });

  it('preserves empty field values', () => {
    const result = parseCsvText('name,price\nPhone,\n,100');

    expect(result.rows).toEqual([
      { name: 'Phone', price: '' },
      { name: '', price: '100' },
    ]);
  });

  it('trims leading and trailing whitespace inside unquoted fields', () => {
    const result = parseCsvText('name,price\n  Phone  , 1000 ');

    expect(result.rows).toEqual([{ name: 'Phone', price: '1000' }]);
  });

  it('supports CRLF line endings', () => {
    const result = parseCsvText('name,price\r\nPhone,1000\r\nCase,100\r\n');

    expect(result.rows).toEqual([
      { name: 'Phone', price: '1000' },
      { name: 'Case', price: '100' },
    ]);
  });
});
