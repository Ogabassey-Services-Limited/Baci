import { describe, expect, it } from 'vitest';
import { unknownValueGuards } from '@/lib/unknown-value-guards';

describe('unknownValueGuards', () => {
  it('accepts plain records and rejects arrays and null', () => {
    const record = { id: 'value' };
    const array: unknown[] = [];
    const empty = null;

    const recordResult = unknownValueGuards.isRecord(record);
    const arrayResult = unknownValueGuards.isRecord(array);
    const emptyResult = unknownValueGuards.isRecord(empty);

    expect(recordResult).toBe(true);
    expect(arrayResult).toBe(false);
    expect(emptyResult).toBe(false);
  });

  it('accepts nonblank strings without changing the stored value', () => {
    const storedValue = ' value ';
    const blankValue = ' ';
    const numericValue = 1;

    const storedResult = unknownValueGuards.nonEmptyString(storedValue);
    const blankResult = unknownValueGuards.nonEmptyString(blankValue);
    const numericResult = unknownValueGuards.nonEmptyString(numericValue);

    expect(storedResult).toBe(storedValue);
    expect(blankResult).toBeNull();
    expect(numericResult).toBeNull();
  });
});
