import { describe, expect, it } from 'vitest';
import { buildWebBotAuthDirectoryResponse } from './web-bot-auth-directory';
import { buildTestKeys } from './web-bot-auth-test-keys';

describe('buildWebBotAuthDirectoryResponse', () => {
  it('builds a signed HTTP message signatures directory response', async () => {
    const keys = buildTestKeys();
    const response = buildWebBotAuthDirectoryResponse({
      authority: 'ogabassey.com',
      now: new Date('2026-06-06T12:00:00.000Z'),
      ...keys,
    });

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe(
      'application/http-message-signatures-directory+json'
    );
    expect(response?.headers.get('signature')).toMatch(/^sig1=:.+:$/);
    expect(response?.headers.get('signature-input')).toContain(
      'tag="http-message-signatures-directory"'
    );
    expect(response?.headers.get('signature-input')).toContain(
      'created=1780747200'
    );
    expect(response?.headers.get('signature-input')).toContain(
      'expires=1780747500'
    );
    expect(response?.headers.get('cache-control')).toBe('public, max-age=60');

    await expect(response?.json()).resolves.toMatchObject({
      keys: [expect.objectContaining({ crv: 'Ed25519', kty: 'OKP' })],
    });
  });

  it('returns null when signing material is absent or malformed', () => {
    const keys = buildTestKeys();

    expect(
      buildWebBotAuthDirectoryResponse({
        authority: 'ogabassey.com',
        publicJwksJson: keys.publicJwksJson,
      })
    ).toBeNull();
    expect(
      buildWebBotAuthDirectoryResponse({
        authority: 'ogabassey.com',
        privateKeyPem: keys.privateKeyPem,
        publicJwksJson: '{"keys":[]}',
      })
    ).toBeNull();
    expect(
      buildWebBotAuthDirectoryResponse({
        authority: 'ogabassey.com',
        privateKeyPem: 'not a private key',
        publicJwksJson: keys.publicJwksJson,
      })
    ).toBeNull();
  });
});
