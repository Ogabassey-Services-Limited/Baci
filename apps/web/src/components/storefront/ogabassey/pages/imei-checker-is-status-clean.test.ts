import { describe, expect, it } from 'vitest';
import { isStatusClean } from './imei-checker-is-status-clean';

describe('isStatusClean', () => {
  it.each([
    'Clean',
    'clean',
    'Not Found',
    'Off',
    'Unlocked',
    'No Repairs',
    'No Cases',
    'Not Replaced',
    'Original',
    'None',
    'Not Active',
    'Inactive',
    'Not Locked',
    'No Lock',
    'Partially Clean',
  ])('treats "%s" as clean', (value) => {
    expect(isStatusClean(value)).toBe(true);
  });

  it.each(['Blacklisted', 'Locked', 'On', 'Active', 'Lost'])(
    'treats "%s" as not clean',
    (value) => {
      expect(isStatusClean(value)).toBe(false);
    }
  );

  it('treats an empty string as not clean', () => {
    expect(isStatusClean('')).toBe(false);
    expect(isStatusClean('   ')).toBe(false);
  });

  it('special-cases "not clean" as false despite containing "clean"', () => {
    expect(isStatusClean('Not Clean')).toBe(false);
  });
});
