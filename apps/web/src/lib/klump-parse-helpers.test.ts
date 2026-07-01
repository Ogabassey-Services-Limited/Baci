import { describe, expect, it } from 'vitest';
import {
  asRecord,
  readBoolean,
  readNonNegativeNumber,
  readNumber,
  readString,
} from '@/lib/klump-parse-helpers';

describe('Klump parse helpers', () => {
  it('normalizes non-record values to empty records', () => {
    expect(asRecord({ status: 'successful' })).toEqual({
      status: 'successful',
    });
    expect(asRecord(null)).toEqual({});
    expect(asRecord(['status'])).toEqual({});
  });

  it('reads the first non-empty trimmed string from the provided sources', () => {
    expect(
      readString(
        [{ reference: '   ' }, { reference: ' BAC-123 ' }],
        ['reference']
      )
    ).toBe('BAC-123');
  });

  it('checks multiple string keys per source before later sources', () => {
    expect(
      readString(
        [{ reference: '', tx_ref: 'BAC-FIRST' }, { reference: 'BAC-SECOND' }],
        ['reference', 'tx_ref']
      )
    ).toBe('BAC-FIRST');
  });

  it('returns null when no string source/key matches', () => {
    expect(
      readString([{ reference: 123 }, { tx_ref: '' }], ['reference'])
    ).toBe(null);
  });

  it('reads positive numeric values and ignores invalid amounts', () => {
    expect(
      readNumber(
        [{ amount: 'not-a-number' }, { amount: '50000.50' }],
        ['amount']
      )
    ).toBe(50_000.5);
    expect(readNumber([{ amount: 0 }], ['amount'])).toBe(null);
    expect(readNumber([{ amount: -1 }, { total_amount: 25 }], ['amount'])).toBe(
      null
    );
    expect(readNumber([{ amount: -1 }, { amount: 25 }], ['amount'])).toBe(25);
  });

  it('reads non-negative numeric values when explicitly requested', () => {
    expect(readNonNegativeNumber([{ amount: '0' }], ['amount'])).toBe(0);
    expect(readNonNegativeNumber([{ amount: 12.5 }], ['amount'])).toBe(12.5);
    expect(readNonNegativeNumber([{ amount: -1 }], ['amount'])).toBe(null);
    expect(readNonNegativeNumber([{ amount: '   ' }], ['amount'])).toBe(null);
  });

  it('reads boolean values without coercion', () => {
    expect(
      readBoolean([{ is_live: 'true' }, { is_live: false }], ['is_live'])
    ).toBe(false);
  });

  it('returns null when no boolean source/key matches', () => {
    expect(
      readBoolean([{ is_live: 'false' }, { live: true }], ['is_live'])
    ).toBe(null);
  });
});
