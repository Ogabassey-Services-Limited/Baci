import { describe, expect, it } from 'vitest';
import { formatPersonName } from './format-person-name';

describe('formatPersonName', () => {
  it('formats lowercase names into sentence case', () => {
    expect(formatPersonName('chidimma azubuike')).toBe('Chidimma Azubuike');
  });

  it('normalizes mixed-case names', () => {
    expect(formatPersonName('cHIYEnYe oKafor')).toBe('Chiyenye Okafor');
  });

  it('preserves apostrophes and hyphens while casing each segment', () => {
    expect(formatPersonName("o'neil-jAMES")).toBe("O'Neil-James");
  });

  it('collapses repeated whitespace', () => {
    expect(formatPersonName('  ada   lovelace  ')).toBe('Ada Lovelace');
  });

  it('returns an empty string for blank input', () => {
    expect(formatPersonName('   ')).toBe('');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatPersonName(null)).toBe('');
    expect(formatPersonName(undefined)).toBe('');
  });
});
