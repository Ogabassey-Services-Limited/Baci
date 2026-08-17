import { describe, expect, it } from 'vitest';
import { jumiaAuthorizationCrypto } from '@/lib/jumia/authorization-crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 8).toString('base64');
const CONTEXT = jumiaAuthorizationCrypto.buildAuthorizationContext(
  '00000000-0000-4000-8000-000000000001',
  'a'.repeat(64)
);
const OTHER_CONTEXT = jumiaAuthorizationCrypto.buildAuthorizationContext(
  '00000000-0000-4000-8000-000000000002',
  'b'.repeat(64)
);
const CREDENTIALS = {
  clientId: 'merchant-client-id',
  refreshToken: 'merchant-refresh-token',
  accessToken: 'short-lived-access-token',
};

describe('Jumia authorization encryption', () => {
  it('round-trips credentials with authenticated encryption', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );

    expect(jumiaAuthorizationCrypto.decrypt(ciphertext, KEY, CONTEXT)).toEqual(
      CREDENTIALS
    );
  });

  it('uses a fresh nonce for every encryption', () => {
    expect(
      jumiaAuthorizationCrypto.encrypt(CREDENTIALS, KEY, CONTEXT)
    ).not.toBe(jumiaAuthorizationCrypto.encrypt(CREDENTIALS, KEY, CONTEXT));
  });

  it('does not include credential values in ciphertext', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );

    expect(ciphertext).not.toContain(CREDENTIALS.clientId);
    expect(ciphertext).not.toContain(CREDENTIALS.refreshToken);
    expect(ciphertext).not.toContain(CREDENTIALS.accessToken);
  });

  it('fails closed with the wrong key', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );

    expect(() =>
      jumiaAuthorizationCrypto.decrypt(ciphertext, OTHER_KEY, CONTEXT)
    ).toThrow('Jumia authorization could not be decrypted');
  });

  it('fails closed when ciphertext is transplanted to another owner context', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );

    expect(() =>
      jumiaAuthorizationCrypto.decrypt(ciphertext, KEY, OTHER_CONTEXT)
    ).toThrow('Jumia authorization could not be decrypted');
  });

  it('fails closed when ciphertext is tampered with', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );
    const tampered = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;

    expect(() =>
      jumiaAuthorizationCrypto.decrypt(tampered, KEY, CONTEXT)
    ).toThrow('Jumia authorization could not be decrypted');
  });

  it('fails closed when the authentication tag is tampered with', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );
    const envelope = JSON.parse(
      Buffer.from(ciphertext, 'base64url').toString('utf8')
    ) as { tag: string };
    envelope.tag = `${envelope.tag.slice(0, -1)}${
      envelope.tag.endsWith('A') ? 'B' : 'A'
    }`;
    const tampered = Buffer.from(JSON.stringify(envelope), 'utf8').toString(
      'base64url'
    );

    expect(() =>
      jumiaAuthorizationCrypto.decrypt(tampered, KEY, CONTEXT)
    ).toThrow('Jumia authorization could not be decrypted');
  });

  it('rejects an invalid encryption key without echoing it', () => {
    expect(() =>
      jumiaAuthorizationCrypto.encrypt(CREDENTIALS, '', CONTEXT)
    ).toThrow('Jumia authorization encryption key must be 32 bytes');
  });

  it('surfaces invalid encryption key errors separately from decryption failures', () => {
    const ciphertext = jumiaAuthorizationCrypto.encrypt(
      CREDENTIALS,
      KEY,
      CONTEXT
    );

    expect(() =>
      jumiaAuthorizationCrypto.decrypt(
        ciphertext,
        Buffer.alloc(16).toString('base64')
      )
    ).toThrow('Jumia authorization encryption key must be 32 bytes');
  });
});
