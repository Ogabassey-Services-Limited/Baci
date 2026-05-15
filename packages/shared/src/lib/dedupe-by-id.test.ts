import { describe, expect, it } from 'vitest';
import { dedupeById } from './dedupe-by-id';

describe('dedupeById', () => {
  it('returns an empty array when input is empty', () => {
    expect(dedupeById([])).toEqual([]);
  });

  it('returns a single item unchanged', () => {
    const products = [{ id: 'prod-1', name: 'Only' }];

    expect(dedupeById(products)).toEqual(products);
  });

  it('keeps unique items in original order', () => {
    const products = [
      { id: 'prod-1', name: 'First' },
      { id: 'prod-2', name: 'Second' },
      { id: 'prod-3', name: 'Third' },
    ];

    expect(dedupeById(products)).toEqual(products);
  });

  it('keeps the first item for each id in original order', () => {
    const products = [
      { id: 'prod-1', name: 'First' },
      { id: 'prod-2', name: 'Second' },
      { id: 'prod-1', name: 'Duplicate' },
    ];

    expect(dedupeById(products)).toEqual([
      { id: 'prod-1', name: 'First' },
      { id: 'prod-2', name: 'Second' },
    ]);
  });

  it('keeps only the first item when every id matches', () => {
    const products = [
      { id: 'prod-1', name: 'First' },
      { id: 'prod-1', name: 'Second' },
      { id: 'prod-1', name: 'Third' },
    ];

    expect(dedupeById(products)).toEqual([{ id: 'prod-1', name: 'First' }]);
  });

  it('dedupes non-consecutive duplicates without changing first occurrence order', () => {
    const products = [
      { id: 'prod-a', name: 'A1' },
      { id: 'prod-b', name: 'B' },
      { id: 'prod-a', name: 'A2' },
      { id: 'prod-c', name: 'C' },
    ];

    expect(dedupeById(products)).toEqual([
      { id: 'prod-a', name: 'A1' },
      { id: 'prod-b', name: 'B' },
      { id: 'prod-c', name: 'C' },
    ]);
  });

  it('treats empty-string ids as valid ids to dedupe', () => {
    const products = [
      { id: '', name: 'Blank first' },
      { id: 'prod-1', name: 'Named' },
      { id: '', name: 'Blank duplicate' },
    ];

    expect(dedupeById(products)).toEqual([
      { id: '', name: 'Blank first' },
      { id: 'prod-1', name: 'Named' },
    ]);
  });
});
