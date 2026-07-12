import { describe, expect, it } from 'vitest';
import { sanitizeEventErrorMessage } from './sanitize-event-error';

describe('sanitizeEventErrorMessage', () => {
  it('removes common identifiers and credentials from provider errors', () => {
    expect(
      sanitizeEventErrorMessage(
        'email person@example.com phone +234 800 000 0000 token=abc123'
      )
    ).toBe('email [redacted-email] phone [redacted-number] token=[redacted]');
  });

  it('preserves diagnostics that contain no identifiers or credentials', () => {
    expect(sanitizeEventErrorMessage('provider returned HTTP 503')).toBe(
      'provider returned HTTP 503'
    );
  });

  it('redacts multi-token authorization and cookie values', () => {
    expect(
      sanitizeEventErrorMessage(
        'authorization: Bearer alpha beta; scope=all, retryable=true'
      )
    ).toBe('authorization=[redacted], retryable=true');
  });
});
