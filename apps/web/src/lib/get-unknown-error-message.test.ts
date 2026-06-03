import { describe, expect, it } from 'vitest';
import { getUnknownErrorMessage } from './get-unknown-error-message';

describe('getUnknownErrorMessage', () => {
  it('returns Error messages', () => {
    expect(getUnknownErrorMessage(new Error('Network unavailable'))).toBe(
      'Network unavailable'
    );
  });

  it('falls back for non-Error values', () => {
    expect(getUnknownErrorMessage('plain string failure')).toBe(
      'An unknown error occurred'
    );
  });
});
