import { describe, expect, it } from 'vitest';
import {
  classifyAuthError,
  getAuthErrorCode,
} from './auth-error-classification';

describe('classifyAuthError', () => {
  it.each([
    [{ code: 'invalid_grant', message: 'Invalid refresh token' }],
    [{ code: 'session_not_found', status: 403 }],
    [{ code: 'refresh_token_not_found', status: 403 }],
    [{ code: 'refresh_token_already_used', status: 403 }],
    [{ code: 'user_not_found', status: 403 }],
    [{ message: 'Refresh Token Not Found' }],
    [{ name: 'AuthSessionMissingError', message: 'Auth session missing' }],
  ])('classifies known terminal auth errors as terminal', (error) => {
    expect(classifyAuthError(error)).toBe('terminal');
  });

  it.each([
    [{ status: 401, message: 'Unauthorized' }],
    [{ status: 403, message: 'Forbidden' }],
    [{ code: 'otp_expired', status: 403, message: 'OTP expired' }],
    [new TypeError('Network request failed')],
    [{ name: 'AbortError', message: 'The operation was aborted' }],
    [{ message: 'fetch failed' }],
    ['unexpected thrown value'],
    [null],
  ])('classifies transient or unknown failures as transient', (error) => {
    expect(classifyAuthError(error)).toBe('transient');
  });
});

describe('getAuthErrorCode', () => {
  it('prefers explicit error codes', () => {
    expect(getAuthErrorCode({ code: 'invalid_grant' })).toBe('invalid_grant');
  });

  it('falls back to status codes and error names', () => {
    expect(getAuthErrorCode({ status: 401 })).toBe('401');
    expect(getAuthErrorCode({ name: 'AuthSessionMissingError' })).toBe(
      'AuthSessionMissingError'
    );
  });
});
