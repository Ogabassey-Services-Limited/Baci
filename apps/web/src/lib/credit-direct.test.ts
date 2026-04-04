import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './credit-direct';

describe('verifyWebhookSignature', () => {
  const payload = JSON.stringify({ event: 'payment.completed', id: 'evt_123' });
  const secret = crypto.randomBytes(32).toString('hex');

  it('returns true for a valid webhook signature', () => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('returns false instead of throwing when the signature length is invalid', () => {
    expect(() =>
      verifyWebhookSignature(payload, 'short-signature', secret)
    ).not.toThrow();
    expect(verifyWebhookSignature(payload, 'short-signature', secret)).toBe(
      false
    );
  });

  it('returns false for an incorrect signature with the expected length', () => {
    const invalidSignature = '0'.repeat(64);

    expect(verifyWebhookSignature(payload, invalidSignature, secret)).toBe(
      false
    );
  });
});
