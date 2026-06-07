import { createPrivateKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WEB_BOT_AUTH_JWKS_SCHEMA } from '@/schemas/web-bot-auth-directory';
import { buildTestKeys } from './web-bot-auth-test-keys';

describe('buildTestKeys', () => {
  it('builds valid Ed25519 Web Bot Auth test keys', () => {
    const keys = buildTestKeys();
    const publicJwks = JSON.parse(keys.publicJwksJson);

    expect(WEB_BOT_AUTH_JWKS_SCHEMA.safeParse(publicJwks).success).toBe(true);
    expect(() => createPrivateKey(keys.privateKeyPem)).not.toThrow();
  });
});
