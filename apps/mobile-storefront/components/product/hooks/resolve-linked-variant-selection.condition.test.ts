import { describe, expect, it } from '@jest/globals';
import { resolveLinkedVariantSelection } from './resolve-linked-variant-selection';

describe('resolveLinkedVariantSelection attribute-backed conditions', () => {
  it('preserves condition when relinking another axis', () => {
    expect(
      resolveLinkedVariantSelection({
        axis: 'storage',
        attributes: { condition: 'open_box' },
        color: null,
        condition: 'open_box',
        storage: '256GB',
        usesVariantConditions: false,
        value: '256GB',
        variants: [
          {
            id: 'used-128',
            name: '128GB Used',
            price: 1,
            attributes: { condition: 'used', storage: '128GB' },
          },
          {
            id: 'open-box-256',
            name: '256GB Open Box',
            price: 2,
            attributes: { condition: 'open_box', storage: '256GB' },
          },
        ],
      })
    ).toEqual({
      attributes: { condition: 'open_box' },
      color: null,
      storage: '256GB',
    });
  });
});
