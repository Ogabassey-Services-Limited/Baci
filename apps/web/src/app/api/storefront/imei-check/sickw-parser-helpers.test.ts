import { describe, expect, it } from 'vitest';
import {
  buildVerdict,
  getProviderField,
  hasBlacklistIssue,
  hasRiskToken,
  inferDeviceType,
} from './sickw-parser-helpers';

const CLEAN_FLAGS = {
  hasIcloudLockOn: false,
  hasIcloudStatusIssue: false,
  hasKnoxGuardIssue: false,
  hasMdmIssue: false,
  hasMiLockIssue: false,
  hasMiLostIssue: false,
  isBlacklisted: false,
  isSimLocked: false,
  status: 'Clean' as const,
};

describe('hasRiskToken', () => {
  it('matches a standalone risk token', () => {
    expect(hasRiskToken('Locked', ['locked'])).toBe(true);
  });

  it('ignores a token negated by a preceding "not" or "no"', () => {
    expect(hasRiskToken('Not active', ['active'])).toBe(false);
    expect(hasRiskToken('No lock', ['lock'])).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(hasRiskToken('', ['locked'])).toBe(false);
  });
});

describe('hasBlacklistIssue', () => {
  it('flags stolen/blacklisted values', () => {
    expect(hasBlacklistIssue('Blacklisted')).toBe(true);
    expect(hasBlacklistIssue('Reported stolen')).toBe(true);
  });

  it('does not flag a clean value', () => {
    expect(hasBlacklistIssue('Clean')).toBe(false);
  });
});

describe('getProviderField', () => {
  it('returns the first non-empty aliased field', () => {
    const data = { 'knox guard status': '', knoxguard: 'Active' };
    expect(getProviderField(data, ['knox guard status', 'knoxguard'])).toBe(
      'Active'
    );
  });

  it('returns an empty string when no alias matches', () => {
    expect(getProviderField({}, ['coverage'])).toBe('');
  });
});

describe('inferDeviceType', () => {
  it('classifies Apple, Android, and other devices', () => {
    expect(inferDeviceType('iPhone 15 Pro')).toBe('apple');
    expect(inferDeviceType('MacBook Air')).toBe('apple');
    expect(inferDeviceType('Samsung Galaxy S24')).toBe('android');
    expect(inferDeviceType('Nokia 3310')).toBe('other');
  });
});

describe('buildVerdict', () => {
  it('returns a caution verdict for an active Knox Guard', () => {
    const verdict = buildVerdict({ ...CLEAN_FLAGS, hasKnoxGuardIssue: true });

    expect(verdict.type).toBe('caution');
    expect(verdict.text).toContain('Samsung Knox Guard');
  });

  it('ranks a blacklist danger ahead of a Knox Guard caution', () => {
    const verdict = buildVerdict({
      ...CLEAN_FLAGS,
      hasKnoxGuardIssue: true,
      isBlacklisted: true,
    });

    expect(verdict.type).toBe('danger');
    expect(verdict.text).not.toContain('Samsung Knox Guard');
  });

  it('returns a safe verdict when everything is clean', () => {
    expect(buildVerdict(CLEAN_FLAGS)).toMatchObject({ type: 'safe' });
  });
});
