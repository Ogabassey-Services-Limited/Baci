import {
  getUsernameCooldownNextEligibleAt,
  getUsernamePolicyError,
  parseUsernameWriteResult,
} from './auth-username-policy';

describe('auth username policy', () => {
  it('preserves a valid server cooldown timestamp', () => {
    const error = {
      details: '2026-09-03T12:00:00.000Z',
      message: 'username_change_cooldown',
    };

    expect(getUsernameCooldownNextEligibleAt(error)).toBe(error.details);
    expect(getUsernamePolicyError(error)).toContain('2026');
  });

  it('parses a username write result without inventing policy dates', () => {
    expect(parseUsernameWriteResult({ username: 'quiz_player' })).toEqual({
      nextEligibleAt: null,
      username: 'quiz_player',
      usernameChangedAt: null,
    });
    expect(parseUsernameWriteResult({})).toBeNull();
  });
});
