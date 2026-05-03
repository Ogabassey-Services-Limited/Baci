import { describe, expect, it } from '@jest/globals';
import { getAddressLabelIcon } from './get-address-label-icon';

describe('getAddressLabelIcon', () => {
  it('maps known address labels to semantic icons', () => {
    expect(getAddressLabelIcon('Home')).toBe('home-outline');
    expect(getAddressLabelIcon('Work')).toBe('business-outline');
    expect(getAddressLabelIcon('Office')).toBe('business-outline');
    expect(getAddressLabelIcon('school')).toBe('school-outline');
    expect(getAddressLabelIcon('University')).toBe('school-outline');
  });

  it('falls back to location-outline for unknown or missing labels', () => {
    expect(getAddressLabelIcon('Vacation')).toBe('location-outline');
    expect(getAddressLabelIcon(undefined)).toBe('location-outline');
    expect(getAddressLabelIcon(null)).toBe('location-outline');
  });
});
