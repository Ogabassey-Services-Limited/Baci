import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPrivateKey,
  getPublicKey,
  getWebhookSecret,
  isLiveMode,
  verifyWebhookSignature,
} from '@/lib/credit-direct';

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

  it('returns false for an empty signature', () => {
    expect(verifyWebhookSignature(payload, '', secret)).toBe(false);
  });

  it('returns false for an incorrect signature with the expected length', () => {
    const invalidSignature = '0'.repeat(64);

    expect(verifyWebhookSignature(payload, invalidSignature, secret)).toBe(
      false
    );
  });

  it('returns false for a signature longer than expected', () => {
    const longSignature = '0'.repeat(128);

    expect(verifyWebhookSignature(payload, longSignature, secret)).toBe(false);
  });
});

describe('Credit Direct environment helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('removes escaped trailing newlines from dashboard keys', () => {
    vi.stubEnv('CREDIT_DIRECT_PRIVATE_KEY', 'private-key-value\\n   ');
    vi.stubEnv('CREDIT_DIRECT_PUBLIC_KEY', 'public-key-value\\n   ');
    vi.stubEnv('CREDIT_DIRECT_WEBHOOK_SECRET', 'webhook-secret\\n   ');

    expect(getPrivateKey()).toBe('private-key-value');
    expect(getPublicKey()).toBe('public-key-value');
    expect(getWebhookSecret()).toBe('webhook-secret');
  });

  it('normalizes actual newlines, carriage returns, and whitespace', () => {
    vi.stubEnv('CREDIT_DIRECT_PRIVATE_KEY', '\r\n private-key-value \n');
    vi.stubEnv('CREDIT_DIRECT_PUBLIC_KEY', ' public-key-value\r\n');
    vi.stubEnv('CREDIT_DIRECT_WEBHOOK_SECRET', '\\rwebhook-secret\\n');

    expect(getPrivateKey()).toBe('private-key-value');
    expect(getPublicKey()).toBe('public-key-value');
    expect(getWebhookSecret()).toBe('webhook-secret');
  });

  it.each([
    ['CREDIT_DIRECT_PRIVATE_KEY', getPrivateKey],
    ['CREDIT_DIRECT_PUBLIC_KEY', getPublicKey],
    ['CREDIT_DIRECT_WEBHOOK_SECRET', getWebhookSecret],
  ])('throws when %s is blank after normalization', (envKey, readValue) => {
    vi.stubEnv(envKey, '\\n \r');

    expect(readValue).toThrow();
  });

  it.each([
    [undefined, true],
    ['false\\n', false],
    [' FALSE ', false],
    ['true', true],
    ['1', true],
    ['', true],
  ])('parses live mode from %s as %s', (envValue, expected) => {
    if (envValue === undefined) {
      vi.stubEnv('CREDIT_DIRECT_IS_LIVE', undefined);
    } else {
      vi.stubEnv('CREDIT_DIRECT_IS_LIVE', envValue);
    }

    expect(isLiveMode()).toBe(expected);
  });
});
