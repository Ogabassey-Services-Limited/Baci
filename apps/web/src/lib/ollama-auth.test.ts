import { describe, expect, it } from 'vitest';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

function expectedBasicHeader(credentials: string): string {
  return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
}

describe('buildOllamaBasicAuthHeader', () => {
  it('returns null for empty credentials', () => {
    expect(buildOllamaBasicAuthHeader('')).toBeNull();
    expect(buildOllamaBasicAuthHeader('   ')).toBeNull();
  });

  it('base64-encodes raw username and password credentials', () => {
    const credentials = ['test-user', 'test-password'].join(':');

    expect(buildOllamaBasicAuthHeader(credentials)).toBe(
      expectedBasicHeader(credentials)
    );
  });

  it('base64-encodes raw UTF-8 credentials', () => {
    const credentials = 'usér:päss!';

    expect(buildOllamaBasicAuthHeader(credentials)).toBe(
      expectedBasicHeader(credentials)
    );
  });

  it.each([
    'test-user:',
    ':test-password',
    'test-user:test-password:extra',
    'test user:test-password',
  ])('base64-encodes RFC-valid raw credentials: %s', (credential) => {
    expect(buildOllamaBasicAuthHeader(credential)).toBe(
      expectedBasicHeader(credential)
    );
  });

  it('prefixes already base64-encoded payload with Basic without re-encoding the payload', () => {
    const credentials = ['test-user', 'test-password'].join(':');
    const encodedCredentials = Buffer.from(credentials, 'utf8').toString(
      'base64'
    );

    expect(buildOllamaBasicAuthHeader(encodedCredentials)).toBe(
      `Basic ${encodedCredentials}`
    );
  });

  it('rejects raw credentials containing control characters', () => {
    expect(buildOllamaBasicAuthHeader('user:\npassword')).toBeNull();
  });

  it('normalizes a full Basic authorization header', () => {
    const credentials = ['test-user', 'test-password'].join(':');
    const encodedCredentials = Buffer.from(credentials, 'utf8').toString(
      'base64'
    );

    expect(buildOllamaBasicAuthHeader(`basic ${encodedCredentials}`)).toBe(
      `Basic ${encodedCredentials}`
    );
  });

  it('rejects malformed full Basic authorization headers', () => {
    expect(buildOllamaBasicAuthHeader('Basic')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic   ')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic not valid')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic token.value')).toBeNull();
  });
});
