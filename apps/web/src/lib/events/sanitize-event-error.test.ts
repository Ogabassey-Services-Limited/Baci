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
        'authorization: Bearer alpha beta; scope=all, cookie: session=secret-cookie; Secure, retryable=true'
      )
    ).toBe('authorization=[redacted], cookie=[redacted], retryable=true');
  });

  it('redacts JSON-shaped secret fields', () => {
    expect(
      sanitizeEventErrorMessage(
        '{"token":"private-token","authorization":"Bearer private"}'
      )
    ).toBe('{"token"=[redacted],"authorization"=[redacted]}');
  });

  it('redacts compound credential field names', () => {
    expect(
      sanitizeEventErrorMessage(
        '{"access_token":"private-access","client_secret":"private-secret","refresh_token":"private-refresh"}'
      )
    ).toBe(
      '{"access_token"=[redacted],"client_secret"=[redacted],"refresh_token"=[redacted]}'
    );
  });
});
