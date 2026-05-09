import { describe, expect, it } from 'vitest';
import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';

describe('buildLlmBearerAuthHeader', () => {
  it('returns null for empty or whitespace-only tokens', () => {
    expect(buildLlmBearerAuthHeader('')).toBeNull();
    expect(buildLlmBearerAuthHeader('   ')).toBeNull();
    expect(buildLlmBearerAuthHeader('\t\n')).toBeNull();
  });

  it('prefixes a valid token with "Bearer "', () => {
    const token = 'a'.repeat(64);
    expect(buildLlmBearerAuthHeader(token)).toBe(`Bearer ${token}`);
  });

  it('preserves the token verbatim — no URL-encoding, no case mutation', () => {
    const token = 'ABcd1234-_./+=';
    expect(buildLlmBearerAuthHeader(token)).toBe(`Bearer ${token}`);
  });

  it('trims surrounding whitespace before applying the prefix', () => {
    const token = '550e8400-e29b-41d4-a716-446655440000';
    expect(buildLlmBearerAuthHeader(`  ${token}  `)).toBe(`Bearer ${token}`);
  });

  it('rejects tokens containing control characters (CR/LF/NUL/TAB)', () => {
    expect(buildLlmBearerAuthHeader('token\nwith-newline')).toBeNull();
    expect(buildLlmBearerAuthHeader('token\rwith-cr')).toBeNull();
    expect(buildLlmBearerAuthHeader('token\x00with-nul')).toBeNull();
    expect(buildLlmBearerAuthHeader('token\twith-tab')).toBeNull();
  });

  it('rejects "BearerXyz" (no separator) as a malformed full-header attempt', () => {
    // Otherwise we'd silently emit "Bearer BearerXyz", which is almost
    // certainly not what the caller meant.
    expect(buildLlmBearerAuthHeader('BearerXyz')).toBeNull();
    expect(buildLlmBearerAuthHeader('bearerToken')).toBeNull();
    expect(buildLlmBearerAuthHeader('BEARER123')).toBeNull();
  });

  it('strips an existing "Bearer " prefix and rebuilds it (case-insensitive, single-space)', () => {
    const token = 'a'.repeat(64);
    expect(buildLlmBearerAuthHeader(`Bearer ${token}`)).toBe(`Bearer ${token}`);
    expect(buildLlmBearerAuthHeader(`bearer ${token}`)).toBe(`Bearer ${token}`);
    expect(buildLlmBearerAuthHeader(`BEARER ${token}`)).toBe(`Bearer ${token}`);
  });

  it('rejects "Bearer" with no payload, even if whitespace follows', () => {
    expect(buildLlmBearerAuthHeader('Bearer')).toBeNull();
    expect(buildLlmBearerAuthHeader('Bearer   ')).toBeNull();
    expect(buildLlmBearerAuthHeader('bearer\t')).toBeNull();
  });

  it('returns a single Authorization header value, not an object', () => {
    const result = buildLlmBearerAuthHeader('opaque-token');
    expect(typeof result).toBe('string');
  });
});
