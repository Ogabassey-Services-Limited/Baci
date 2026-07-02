import { isStatusClean } from './is-status-clean';

describe('isStatusClean', () => {
  it.each([
    'clean',
    'not found',
    'off',
    'partially clean',
    'unlocked',
    'No Repairs',
    'No Cases',
    'Not Replaced',
    'Original',
    'None',
    'Not active',
    'Inactive',
    'Not locked',
    'No lock',
  ])('treats %s as clean', (status) => {
    expect(isStatusClean(status)).toBe(true);
  });

  it.each([
    'locked',
    'unclean',
    'cleaning',
    'not clean',
    'reported stolen',
    'unknown',
  ])('does not treat %s as clean', (status) => {
    expect(isStatusClean(status)).toBe(false);
  });
});
