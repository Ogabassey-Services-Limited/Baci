import { describe, expect, it } from 'vitest';
import { normalizeBusinessName } from './normalize-business-name';

describe('normalizeBusinessName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeBusinessName('  Zorvexa  ')).toBe('Zorvexa');
  });

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeBusinessName('Foo   Bar')).toBe('Foo Bar');
    expect(normalizeBusinessName('Foo\t\nBar')).toBe('Foo Bar');
  });

  it('handles combined leading, internal, and trailing whitespace', () => {
    expect(normalizeBusinessName('  Foo   Bar  ')).toBe('Foo Bar');
  });

  it('leaves an already-clean name unchanged', () => {
    expect(normalizeBusinessName('Foo Bar')).toBe('Foo Bar');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeBusinessName('   ')).toBe('');
  });

  it('returns an empty string for null or undefined', () => {
    expect(normalizeBusinessName(null)).toBe('');
    expect(normalizeBusinessName(undefined)).toBe('');
  });
});
