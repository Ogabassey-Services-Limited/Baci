import { describe, expect, it } from 'vitest';
import {
  getValidatedInternalAuthMethod,
  hasValidInternalAuth,
  INTERNAL_AUTH_HEADER,
} from '@/lib/internal-auth-header';

const SECRET = 'super-secret-value';

function requestWith(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

describe('hasValidInternalAuth', () => {
  it('accepts the correct secret via the custom x-baci-internal-auth header', () => {
    const request = requestWith({ [INTERNAL_AUTH_HEADER]: SECRET });

    expect(hasValidInternalAuth(request, SECRET)).toBe(true);
  });

  it('accepts the correct secret via the legacy Authorization bearer header', () => {
    const request = requestWith({ Authorization: `Bearer ${SECRET}` });

    expect(hasValidInternalAuth(request, SECRET)).toBe(true);
  });

  it('rejects a wrong secret in the custom header', () => {
    const request = requestWith({ [INTERNAL_AUTH_HEADER]: 'wrong' });

    expect(hasValidInternalAuth(request, SECRET)).toBe(false);
  });

  it('rejects a bare secret (no Bearer prefix) sent via Authorization', () => {
    // The legacy path expects the `Bearer ` prefix; a raw value must not match.
    const request = requestWith({ Authorization: SECRET });

    expect(hasValidInternalAuth(request, SECRET)).toBe(false);
  });

  it('rejects a wrong bearer token in the Authorization header', () => {
    const request = requestWith({ Authorization: 'Bearer wrong' });

    expect(hasValidInternalAuth(request, SECRET)).toBe(false);
  });

  it('rejects a request carrying neither header', () => {
    const request = requestWith({});

    expect(hasValidInternalAuth(request, SECRET)).toBe(false);
  });

  it('rejects an empty custom header value', () => {
    const request = requestWith({ [INTERNAL_AUTH_HEADER]: '' });

    expect(hasValidInternalAuth(request, SECRET)).toBe(false);
  });
});

describe('getValidatedInternalAuthMethod', () => {
  it('identifies the custom-header path (the only cache-eligible one)', () => {
    const request = requestWith({ [INTERNAL_AUTH_HEADER]: SECRET });

    expect(getValidatedInternalAuthMethod(request, SECRET)).toBe(
      'custom-header'
    );
  });

  it('identifies the legacy Authorization path', () => {
    const request = requestWith({ Authorization: `Bearer ${SECRET}` });

    expect(getValidatedInternalAuthMethod(request, SECRET)).toBe(
      'authorization'
    );
  });

  it('prefers the custom header when both headers carry the secret', () => {
    const request = requestWith({
      [INTERNAL_AUTH_HEADER]: SECRET,
      Authorization: `Bearer ${SECRET}`,
    });

    expect(getValidatedInternalAuthMethod(request, SECRET)).toBe(
      'custom-header'
    );
  });

  it('falls back to a valid Authorization header when the custom header is wrong', () => {
    const request = requestWith({
      [INTERNAL_AUTH_HEADER]: 'wrong',
      Authorization: `Bearer ${SECRET}`,
    });

    expect(getValidatedInternalAuthMethod(request, SECRET)).toBe(
      'authorization'
    );
  });

  it('returns null when neither header matches', () => {
    const request = requestWith({
      [INTERNAL_AUTH_HEADER]: 'wrong',
      Authorization: 'Bearer wrong',
    });

    expect(getValidatedInternalAuthMethod(request, SECRET)).toBeNull();
  });
});
