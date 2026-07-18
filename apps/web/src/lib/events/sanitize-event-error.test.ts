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

  it('redacts exact sensitive values longest-first without a minimum length', () => {
    expect(sanitizeEventErrorMessage('abc|ab|a', ['a', 'abc', 'ab'])).toBe(
      '[redacted]|[redacted]|[redacted]'
    );
  });

  it('redacts deterministic JSON and query transport representations', () => {
    const sensitiveValue = 'api secret/with?query&quote="\\path';
    const jsonEscaped = JSON.stringify(sensitiveValue).slice(1, -1);
    const uriEncoded = encodeURIComponent(sensitiveValue);
    const queryEncoded = new URLSearchParams({ value: sensitiveValue })
      .toString()
      .slice('value='.length);

    expect(
      sanitizeEventErrorMessage(
        `${sensitiveValue}|${jsonEscaped}|${uriEncoded}|${queryEncoded}`,
        [sensitiveValue]
      )
    ).toBe('[redacted]|[redacted]|[redacted]|[redacted]');
  });

  it.each([
    'uri',
    'form',
  ] as const)('redacts lowercase and mixed-case percent escapes in %s encoding', (encoding) => {
    const sensitiveValue = 'api secret/with?query&quote="\\path';
    const encoded =
      encoding === 'uri'
        ? encodeURIComponent(sensitiveValue)
        : new URLSearchParams({ value: sensitiveValue })
            .toString()
            .slice('value='.length);
    let escapeIndex = 0;
    const mixedCasePercentEscapes = encoded.replace(
      /%[0-9A-F]{2}/g,
      (percentEscape) => {
        escapeIndex += 1;
        return escapeIndex % 2 === 0
          ? percentEscape.toLowerCase()
          : percentEscape.toUpperCase();
      }
    );

    expect(
      sanitizeEventErrorMessage(
        `${encoded.toLowerCase()}|${mixedCasePercentEscapes}`,
        [sensitiveValue]
      )
    ).toBe('[redacted]|[redacted]');
  });

  it('does not throw when a sensitive value contains a lone surrogate', () => {
    const sensitiveValue = '\uD800';

    expect(
      sanitizeEventErrorMessage(`provider echoed ${sensitiveValue}`, [
        sensitiveValue,
      ])
    ).toBe('provider echoed [redacted]');
  });
});
