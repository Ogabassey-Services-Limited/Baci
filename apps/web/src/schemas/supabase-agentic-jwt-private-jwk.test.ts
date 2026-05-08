import { describe, expect, it } from 'vitest';
import {
  supabaseAgenticJwtPrivateJwkSchema,
  supabaseAgenticJwtPrivateJwkStringSchema,
} from '@/schemas/supabase-agentic-jwt-private-jwk';

const validPrivateJwk = {
  alg: 'ES256',
  crv: 'P-256',
  d: 'private-key-material',
  kid: 'agentic-test-key',
  kty: 'EC',
  x: 'public-x-coordinate',
  y: 'public-y-coordinate',
};

const invalidPrivateJwkCases = [
  ['malformed JSON', '{bad-json'],
  ['wrong algorithm', JSON.stringify({ ...validPrivateJwk, alg: 'RS256' })],
  ['missing key id', JSON.stringify({ ...validPrivateJwk, kid: '' })],
  ['missing private material', JSON.stringify({ ...validPrivateJwk, d: '' })],
  ['wrong key type', JSON.stringify({ ...validPrivateJwk, kty: 'RSA' })],
  ['wrong curve', JSON.stringify({ ...validPrivateJwk, crv: 'P-384' })],
] as const;

describe('supabaseAgenticJwtPrivateJwkSchema', () => {
  it('accepts an ES256 private EC JWK with a key id', () => {
    const result = supabaseAgenticJwtPrivateJwkSchema.safeParse(
      JSON.stringify(validPrivateJwk)
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validPrivateJwk);
  });

  it('accepts a private EC JWK without an alg member', () => {
    const { alg: _alg, ...privateJwkWithoutAlg } = validPrivateJwk;
    const result = supabaseAgenticJwtPrivateJwkSchema.safeParse(
      JSON.stringify(privateJwkWithoutAlg)
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      ...privateJwkWithoutAlg,
      alg: 'ES256',
    });
  });

  it.each(invalidPrivateJwkCases)('rejects %s', (_caseName, rawPrivateJwk) => {
    const result = supabaseAgenticJwtPrivateJwkSchema.safeParse(rawPrivateJwk);

    expect(result.success).toBe(false);
  });
});

describe('supabaseAgenticJwtPrivateJwkStringSchema', () => {
  it('accepts a valid JSON string and preserves the trimmed raw value', () => {
    const rawPrivateJwk = `  ${JSON.stringify(validPrivateJwk)}  `;
    const result =
      supabaseAgenticJwtPrivateJwkStringSchema.safeParse(rawPrivateJwk);

    expect(result.success).toBe(true);
    expect(result.data).toBe(JSON.stringify(validPrivateJwk));
  });

  it('accepts a valid JSON string without an alg member', () => {
    const { alg: _alg, ...privateJwkWithoutAlg } = validPrivateJwk;
    const result = supabaseAgenticJwtPrivateJwkStringSchema.safeParse(
      JSON.stringify(privateJwkWithoutAlg)
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe(JSON.stringify(privateJwkWithoutAlg));
  });

  it('treats empty values as unset', () => {
    const result = supabaseAgenticJwtPrivateJwkStringSchema.safeParse('');

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('treats whitespace-only values as unset', () => {
    const result = supabaseAgenticJwtPrivateJwkStringSchema.safeParse('   ');

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it.each(invalidPrivateJwkCases)('rejects %s', (_caseName, rawPrivateJwk) => {
    const result =
      supabaseAgenticJwtPrivateJwkStringSchema.safeParse(rawPrivateJwk);

    expect(result.success).toBe(false);
  });
});
