// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyAppleWebhookSignature } from './apple-webhook-signature';

const SECRET = 'whsec_test_value';
const BODY = JSON.stringify({ data: { type: 'appStoreVersionState' } });

function sign(body: string, secret: string, encoding: 'hex' | 'base64') {
  return createHmac('sha256', secret).update(body, 'utf8').digest(encoding);
}

describe('verifyAppleWebhookSignature', () => {
  it('accepts a valid hex signature', () => {
    expect(
      verifyAppleWebhookSignature(BODY, sign(BODY, SECRET, 'hex'), SECRET)
    ).toBe(true);
  });

  it('accepts a valid base64 signature', () => {
    expect(
      verifyAppleWebhookSignature(BODY, sign(BODY, SECRET, 'base64'), SECRET)
    ).toBe(true);
  });

  it('accepts an algorithm-prefixed signature (hmacsha256=<hex>)', () => {
    const header = `hmacsha256=${sign(BODY, SECRET, 'hex')}`;
    expect(verifyAppleWebhookSignature(BODY, header, SECRET)).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(
      verifyAppleWebhookSignature(BODY, sign(BODY, 'other', 'hex'), SECRET)
    ).toBe(false);
  });

  it('rejects when the body was tampered with', () => {
    const signature = sign(BODY, SECRET, 'hex');
    expect(verifyAppleWebhookSignature(`${BODY} `, signature, SECRET)).toBe(
      false
    );
  });

  it('rejects a missing signature header', () => {
    expect(verifyAppleWebhookSignature(BODY, null, SECRET)).toBe(false);
  });

  it('rejects when the secret is empty', () => {
    expect(
      verifyAppleWebhookSignature(BODY, sign(BODY, SECRET, 'hex'), '')
    ).toBe(false);
  });

  it('rejects a garbage signature value', () => {
    expect(verifyAppleWebhookSignature(BODY, 'not-a-signature', SECRET)).toBe(
      false
    );
  });
});
