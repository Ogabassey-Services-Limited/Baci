import { describe, expect, it } from 'vitest';
import { WEB_BOT_AUTH_JWKS_SCHEMA } from './web-bot-auth-directory';

describe('WEB_BOT_AUTH_JWKS_SCHEMA', () => {
  it('accepts an Ed25519 public JWKS directory', () => {
    expect(
      WEB_BOT_AUTH_JWKS_SCHEMA.safeParse({
        keys: [{ crv: 'Ed25519', kty: 'OKP', x: 'public-key' }],
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
});
