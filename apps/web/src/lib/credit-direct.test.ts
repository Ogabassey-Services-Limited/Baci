import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPrivateKey,
  getPublicKey,
  getWebhookSecret,
  normalizeCreditDirectEnvValue,
  verifyWebhookSignature,
} from '@/lib/credit-direct';

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  it('preserves clean values without edge newlines', () => {
    expect(normalizeCreditDirectEnvValue('clean-private-key')).toBe(
      'clean-private-key'
    );
    expect(normalizeCreditDirectEnvValue('another-clean-value-123')).toBe(
      'another-clean-value-123'
    );
  });

  it('normalizes escaped trailing newlines followed by whitespace', () => {
    vi.stubEnv('CREDIT_DIRECT_PRIVATE_KEY', 'private-key\\n   ');
    vi.stubEnv('CREDIT_DIRECT_PUBLIC_KEY', 'public-key\\n   ');
    vi.stubEnv('CREDIT_DIRECT_WEBHOOK_SECRET', 'webhook-secret\\n   ');

    expect(getPrivateKey()).toBe('private-key');
    expect(getPublicKey()).toBe('public-key');
    expect(getWebhookSecret()).toBe('webhook-secret');
  });

  it('normalizes escaped edge newlines with surrounding spaces', () => {
    expect(normalizeCreditDirectEnvValue(' \\n private-key \\n ')).toBe(
      'private-key'
    );
    expect(normalizeCreditDirectEnvValue(' \r\n public-key \r\n ')).toBe(
      'public-key'
    );
  });

  it('normalizes multiple escaped and real edge newlines', () => {
    expect(normalizeCreditDirectEnvValue('key\\n\\n')).toBe('key');
    expect(normalizeCreditDirectEnvValue('key\n\n')).toBe('key');
    expect(normalizeCreditDirectEnvValue('key\\n\n')).toBe('key');
  });

  it('normalizes blank values to an empty string', () => {
    expect(normalizeCreditDirectEnvValue('   ')).toBe('');
    expect(normalizeCreditDirectEnvValue('')).toBe('');
  });
});
