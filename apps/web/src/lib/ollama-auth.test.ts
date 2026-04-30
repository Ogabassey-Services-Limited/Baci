import { describe, expect, it } from 'vitest';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

describe('buildOllamaBasicAuthHeader', () => {
  it('returns null for empty credentials', () => {
    expect(buildOllamaBasicAuthHeader('')).toBeNull();
    expect(buildOllamaBasicAuthHeader('   ')).toBeNull();
  });

  it('base64-encodes raw username and password credentials', () => {
    expect(buildOllamaBasicAuthHeader('user:password')).toBe(
      'Basic dXNlcjpwYXNzd29yZA=='
    );
  });

  it('base64-encodes raw UTF-8 credentials', () => {
    expect(buildOllamaBasicAuthHeader('usér:päss!')).toBe(
      'Basic dXPDqXI6cMOkc3Mh'
    );
  });

  it('base64-encodes RFC-valid raw credentials', () => {
    expect(buildOllamaBasicAuthHeader('user:')).toBe('Basic dXNlcjo=');
    expect(buildOllamaBasicAuthHeader(':password')).toBe('Basic OnBhc3N3b3Jk');
    expect(buildOllamaBasicAuthHeader('user:pass:extra')).toBe(
      'Basic dXNlcjpwYXNzOmV4dHJh'
    );
    expect(buildOllamaBasicAuthHeader('user name:password')).toBe(
      'Basic dXNlciBuYW1lOnBhc3N3b3Jk'
    );
  });

  it('rejects raw credentials containing control characters', () => {
    expect(buildOllamaBasicAuthHeader('user:\npassword')).toBeNull();
  });

  it('keeps an already encoded Basic payload unchanged', () => {
    expect(buildOllamaBasicAuthHeader('dXNlcjpwYXNzd29yZA==')).toBe(
      'Basic dXNlcjpwYXNzd29yZA=='
    );
  });

  it('normalizes a full Basic authorization header', () => {
    expect(buildOllamaBasicAuthHeader('basic dXNlcjpwYXNzd29yZA==')).toBe(
      'Basic dXNlcjpwYXNzd29yZA=='
    );
  });

  it('rejects malformed full Basic authorization headers', () => {
    expect(buildOllamaBasicAuthHeader('Basic')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic   ')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic not valid')).toBeNull();
    expect(buildOllamaBasicAuthHeader('Basic token.value')).toBeNull();
  });
});
