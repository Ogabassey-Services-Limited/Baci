import { describe, expect, it } from '@jest/globals';
import { getAddressLabelIcon } from './get-address-label-icon';

describe('getAddressLabelIcon', () => {
  it('maps known address labels to semantic icons', () => {
    expect(getAddressLabelIcon('Home')).toBe('home-outline');
    expect(getAddressLabelIcon('Work')).toBe('briefcase-outline');
    expect(getAddressLabelIcon('Office')).toBe('briefcase-outline');
  });

  it('falls back to a generic icon for unknown labels', () => {
    expect(getAddressLabelIcon('Vacation')).toBe('business-outline');
    expect(getAddressLabelIcon(undefined)).toBe('business-outline');
  });
});
