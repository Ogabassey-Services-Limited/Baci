import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './webhook-signature';

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('MyCover webhook signature verification', () => {
  it('accepts signatures generated from canonical JSON', async () => {
    const rawBody = '{\n  "event": "purchase.successful"\n}';
    const signature = await hmacSha512Hex(
      'secret',
      JSON.stringify(JSON.parse(rawBody))
    );

    await expect(
      verifyWebhookSignature(rawBody, signature, 'secret')
    ).resolves.toBe(true);
  });

  it('rejects missing signatures', async () => {
    await expect(verifyWebhookSignature('{}', null, 'secret')).resolves.toBe(
      false
    );
  });
});
