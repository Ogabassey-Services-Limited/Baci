import { describe, expect, it } from 'vitest';
import { isRawDbProductRecord } from './raw-db-product';

describe('isRawDbProductRecord', () => {
  it('narrows unknown values to raw product records', () => {
    expect(
      isRawDbProductRecord({
        id: 'prod-1',
        name: 'Samsung Galaxy S25',
        price: 860000,
      })
    ).toBe(true);
    expect(isRawDbProductRecord(null)).toBe(false);
    expect(isRawDbProductRecord('not-an-object')).toBe(false);
    expect(isRawDbProductRecord(42)).toBe(false);
    expect(isRawDbProductRecord(undefined)).toBe(false);
    expect(isRawDbProductRecord({ name: 'Missing id', price: 1000 })).toBe(
      false
    );
    expect(isRawDbProductRecord({ id: 'p-1', name: 'Missing price' })).toBe(
      false
    );
    expect(
      isRawDbProductRecord({ id: 1, name: 'Wrong id type', price: 1000 })
    ).toBe(false);
    expect(isRawDbProductRecord({ id: 'p-1', name: 5, price: 1000 })).toBe(
      false
    );
    expect(
      isRawDbProductRecord({ id: 'p-1', name: 'Bad price', price: '1000' })
    ).toBe(false);
  });
});
