import { isStatusClean } from './is-status-clean';

describe('isStatusClean', () => {
  it.each([
    'clean',
    'not found',
    'off',
    'partially clean',
  ])('treats %s as clean', (status) => {
    expect(isStatusClean(status)).toBe(true);
  });

  it.each([
    'locked',
    'reported stolen',
    'unknown',
  ])('does not treat %s as clean', (status) => {
    expect(isStatusClean(status)).toBe(false);
  });
});
