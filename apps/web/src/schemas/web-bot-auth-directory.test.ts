import { describe, expect, it } from 'vitest';
import { WEB_BOT_AUTH_JWKS_SCHEMA } from './web-bot-auth-directory';

describe('WEB_BOT_AUTH_JWKS_SCHEMA', () => {
  it('accepts an Ed25519 public JWKS directory', () => {
    expect(
      WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({
        keys: [
          {
            alg: 'EdDSA',
            crv: 'Ed25519',
            key_ops: ['verify'],
            kid: 'active',
            kty: 'OKP',
            use: 'sig',
            x: 'public-key',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects empty directories and non-Ed25519 keys', () => {
    expect(WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({ keys: [] }).success).toBe(
      false
    );
    expect(
      WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({
        keys: [{ crv: 'P-256', kty: 'EC', x: 'public-key' }],
      }).success
    ).toBe(false);
  });

  it('rejects missing or empty required JWK members', () => {
    for (const key of [
      { crv: 'Ed25519', kty: 'OKP', x: '' },
      { crv: 'Ed25519', kty: 'OKP' },
      { kty: 'OKP', x: 'public-key' },
      { crv: 'Ed25519', x: 'public-key' },
    ]) {
      expect(WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({ keys: [key] }).success).toBe(
        false
      );
    }
  });

  it('rejects private or unknown JWK members', () => {
    expect(
      WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({
        keys: [
          { crv: 'Ed25519', d: 'private-key', kty: 'OKP', x: 'public-key' },
        ],
      }).success
    ).toBe(false);
    expect(
      WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({
        keys: [
          { crv: 'Ed25519', extra: 'unexpected', kty: 'OKP', x: 'public-key' },
        ],
      }).success
    ).toBe(false);
  });
});
