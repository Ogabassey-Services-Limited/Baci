import { describe, expect, it } from '@jest/globals';
import { normalizeSavedAddresses } from './saved-addresses';

describe('normalizeSavedAddresses', () => {
  it('marks the only saved address as default', () => {
    expect(
      normalizeSavedAddresses([{ id: 'addr_1', is_default: false }])
    ).toEqual([{ id: 'addr_1', is_default: true }]);
  });

  it('keeps a single default address unchanged', () => {
    expect(
      normalizeSavedAddresses([{ id: 'addr_1', is_default: true }])
    ).toEqual([{ id: 'addr_1', is_default: true }]);
  });

  it('does not rewrite multi-address arrays', () => {
    expect(
      normalizeSavedAddresses([
        { id: 'addr_1', is_default: false },
        { id: 'addr_2', is_default: false },
      ])
    ).toEqual([
      { id: 'addr_1', is_default: false },
      { id: 'addr_2', is_default: false },
    ]);
  });
});
