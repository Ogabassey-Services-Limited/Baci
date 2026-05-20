import { describe, expect, it } from '@jest/globals';
import { resolveAvailableProductCondition } from './product-condition-selection';

describe('resolveAvailableProductCondition', () => {
  it('normalizes preferred route conditions before matching availability', () => {
    expect(
      resolveAvailableProductCondition({
        availableConditions: ['new', 'used'],
        preferredConditions: ['Used'],
      })
    ).toBe('used');
  });

  it('uses the display condition before falling back to the first available condition', () => {
    expect(
      resolveAvailableProductCondition({
        availableConditions: ['new', 'open_box'],
        preferredConditions: ['premium-used', 'refurbished'],
      })
    ).toBe('open_box');
  });

  it('returns null when no conditions are available', () => {
    expect(
      resolveAvailableProductCondition({
        availableConditions: [],
        preferredConditions: ['used'],
      })
    ).toBeNull();
  });
});
