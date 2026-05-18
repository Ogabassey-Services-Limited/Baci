import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage } from './sanitize-error-message';

describe('sanitizeErrorMessage', () => {
  it('returns error messages from Error instances', () => {
    expect(sanitizeErrorMessage(new Error('metrics failed'))).toBe(
      'metrics failed'
    );
  });

  it('returns message fields from object-shaped errors', () => {
    expect(sanitizeErrorMessage({ message: 'feed unavailable' })).toBe(
      'feed unavailable'
    );
  });

  it('returns string errors directly', () => {
    expect(sanitizeErrorMessage('plain failure')).toBe('plain failure');
  });

  it('uses a generic message when no safe message exists', () => {
    expect(sanitizeErrorMessage({ code: '500' })).toBe('Unknown error');
    expect(sanitizeErrorMessage(null)).toBe('Unknown error');
  });
});
