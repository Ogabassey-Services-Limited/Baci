import { describe, expect, it } from '@jest/globals';
import { shallowEqualRecord } from './shallow-equal-record';

describe('shallowEqualRecord', () => {
  it('compares string records by keys and values', () => {
    expect(shallowEqualRecord({ color: 'Black' }, { color: 'Black' })).toBe(
      true
    );
    expect(shallowEqualRecord({ color: 'Black' }, { color: 'Blue' })).toBe(
      false
    );
    expect(
      shallowEqualRecord({ color: 'Black' }, { color: 'Black', storage: '1TB' })
    ).toBe(false);
  });
});
